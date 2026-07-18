import type { IncomingMessage, ServerResponse } from 'http';
import { getModel, normalizeModelId } from '../src/lib/models';
import {
  assertCanGenerate,
  chargeAfterSuccess,
  getModelSystemPrompt,
  maxTokensFor,
} from './firebaseAdmin';
import { AITUNNEL_MODEL_ID, buildSystemPrompt, type ReasoningPhase } from './prompts';

export type ChatBody = {
  modelId?: string;
  messages?: { role: string; content: string }[];
  maxTokens?: number;
  systemExtra?: string;
  systemOverride?: string;
  reasoningPhase?: ReasoningPhase;
  /** клиент сообщает режим рассуждений — стоимость считает сервер */
  reasoning?: boolean;
};

const rateBucket = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 40;
const RATE_WINDOW_MS = 60_000;

function clientIp(req: IncomingMessage): string {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.trim()) return xf.split(',')[0].trim();
  return req.socket.remoteAddress || 'unknown';
}

function rateLimitOk(ip: string): boolean {
  const now = Date.now();
  const cur = rateBucket.get(ip);
  if (!cur || now >= cur.resetAt) {
    rateBucket.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  cur.count += 1;
  return cur.count <= RATE_LIMIT;
}

function bearerToken(req: IncomingMessage): string | null {
  const h = req.headers.authorization;
  if (!h || typeof h !== 'string') return null;
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m?.[1]?.trim() || null;
}

function readJsonBody(req: IncomingMessage): Promise<ChatBody> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    const MAX = 512_000;
    req.on('data', (c) => {
      const buf = Buffer.isBuffer(c) ? c : Buffer.from(c);
      size += buf.length;
      if (size > MAX) {
        reject(new Error('Слишком большой запрос'));
        req.destroy();
        return;
      }
      chunks.push(buf);
    });
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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
      error: 'AITUNNEL_API_KEY не задан. Запусти: ai-tool → Настройки',
    });
    return;
  }

  const ip = clientIp(req);
  if (!rateLimitOk(ip)) {
    sendJson(res, 429, { error: 'Слишком много запросов. Подожди минуту.' });
    return;
  }

  try {
    const body = await readJsonBody(req);

    if (typeof body.systemOverride === 'string' && body.systemOverride.trim()) {
      sendJson(res, 400, { error: 'systemOverride запрещён' });
      return;
    }

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

    const reasoning =
      body.reasoning === true ||
      body.reasoningPhase === 'think' ||
      body.reasoningPhase === 'answer';

    // Шаг think не списываем отдельно — списываем один раз на answer / обычный ответ
    const chargeNow = body.reasoningPhase !== 'think';

    const gateResult = await assertCanGenerate({
      idToken: bearerToken(req),
      ip,
      modelId,
      reasoning: body.reasoning === true,
    });

    if (!gateResult.ok) {
      sendJson(res, gateResult.status, { error: gateResult.error });
      return;
    }

    const { gate } = gateResult;
    // Админ не тратит кредиты; гости и юзеры — да
    const shouldCharge = chargeNow && !gate.isAdmin;

    if (shouldCharge && gate.limit != null && gate.used + gate.cost > gate.limit) {
      sendJson(res, 402, { error: 'Недостаточно кредитов' });
      return;
    }

    const maxTokens = maxTokensFor(gate, model.defaultMaxTokens);
    const systemExtra =
      typeof body.systemExtra === 'string' ? body.systemExtra.trim().slice(0, 2000) : '';
    const phase =
      body.reasoningPhase === 'think' || body.reasoningPhase === 'answer'
        ? body.reasoningPhase
        : undefined;
    const modelSystemExtra = await getModelSystemPrompt(modelId);

    const systemContent = buildSystemPrompt(modelId, systemExtra || null, {
      reasoningPhase: phase,
      modelSystemExtra: modelSystemExtra || null,
    });

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

    let usage = { used: gate.used, limit: gate.limit };
    if (shouldCharge) {
      const tokensApprox = Math.ceil(content.length / 4);
      usage = await chargeAfterSuccess(gate, tokensApprox, ip);
    }

    sendJson(res, 200, {
      content,
      modelId,
      usage: {
        used: usage.used,
        limit: usage.limit,
        cost: shouldCharge ? gate.cost : 0,
        planId: gate.planId,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка прокси';
    sendJson(res, 500, { error: message });
  }
}
