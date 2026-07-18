import type { IncomingMessage, ServerResponse } from 'http';
import { buildSystemPrompt, AITUNNEL_MODEL_ID } from '../src/lib/xlaude';
import { getModel, normalizeModelId } from '../src/lib/models';

export type ChatBody = {
  modelId?: string;
  messages?: { role: string; content: string }[];
  maxTokens?: number;
  systemExtra?: string;
  systemOverride?: string;
  reasoningPhase?: 'think' | 'answer';
};

function readJsonBody(req: IncomingMessage): Promise<ChatBody> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8') || '{}';
        resolve(JSON.parse(raw) as ChatBody);
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function applyCors(req: IncomingMessage, res: ServerResponse) {
  const raw = process.env.CORS_ORIGIN || '*';
  const allowed = raw.split(',').map((s) => s.trim()).filter(Boolean);
  const origin = req.headers.origin;
  if (allowed.includes('*')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export function sendJson(res: ServerResponse, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

export async function handleChat(
  req: IncomingMessage,
  res: ServerResponse,
  apiKey: string,
) {
  applyCors(req, res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  if (!apiKey) {
    sendJson(res, 500, {
      error: 'AITUNNEL_API_KEY не задан. Добавьте ключ в .env на VPS',
    });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const modelId = normalizeModelId(body.modelId);
    const model = getModel(modelId);
    const history = (body.messages ?? [])
      .filter(
        (m) =>
          m &&
          typeof m.content === 'string' &&
          (m.role === 'user' || m.role === 'assistant'),
      )
      .slice(-24)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 8000) }));

    if (!history.length) {
      sendJson(res, 400, { error: 'Нет сообщений' });
      return;
    }

    const maxTokensRaw = Number(body.maxTokens);
    const maxTokens = Number.isFinite(maxTokensRaw)
      ? Math.min(8192, Math.max(256, Math.round(maxTokensRaw)))
      : model.defaultMaxTokens;

    const systemOverride =
      typeof body.systemOverride === 'string' ? body.systemOverride.trim() : '';
    const systemExtra =
      typeof body.systemExtra === 'string' ? body.systemExtra.trim() : '';
    const phase =
      body.reasoningPhase === 'think' || body.reasoningPhase === 'answer'
        ? body.reasoningPhase
        : undefined;
    const systemContent = systemOverride
      ? systemOverride.slice(0, 12000)
      : buildSystemPrompt(modelId, systemExtra || null, { reasoningPhase: phase });

    const upstream = await fetch('https://api.aitunnel.ru/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: AITUNNEL_MODEL_ID,
        max_tokens: maxTokens,
        temperature: model.temperature,
        messages: [{ role: 'system', content: systemContent }, ...history],
      }),
    });

    const data = (await upstream.json().catch(() => null)) as {
      choices?: { message?: { content?: string } }[];
      error?: { message?: string } | string;
    } | null;

    if (!upstream.ok) {
      const msg =
        typeof data?.error === 'string'
          ? data.error
          : data?.error?.message || `AITUNNEL ${upstream.status}`;
      sendJson(res, upstream.status, { error: msg });
      return;
    }

    const content = data?.choices?.[0]?.message?.content?.trim();
    if (!content) {
      sendJson(res, 502, { error: 'Пустой ответ от AITUNNEL' });
      return;
    }

    sendJson(res, 200, { content, model: AITUNNEL_MODEL_ID, modelId });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка прокси';
    sendJson(res, 500, { error: message });
  }
}
