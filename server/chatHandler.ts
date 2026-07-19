import type { IncomingMessage, ServerResponse } from 'http';
import { getModel, normalizeModelId } from '../src/lib/models';
import {
  assertCanGenerate,
  chargeAfterSuccess,
  getMaintenanceBlock,
  getModelSystemPrompt,
  maxTokensFor,
} from './firebaseAdmin';
import { AITUNNEL_MODEL_ID, buildSystemPrompt, type ReasoningPhase } from './prompts';
import {
  CODING_SYSTEM_EXTRA,
  NO_WEB_WEATHER_EXTRA,
  WEB_SYSTEM_EXTRA,
  buildToolList,
  type ToolCallFn,
} from './tools';
import { extractTextualToolCalls } from './parseTextToolCalls';

export type ChatBodyMessage = {
  role: string;
  content?: string | null;
  tool_call_id?: string;
  name?: string;
  tool_calls?: ToolCallFn[];
};

export type ChatBody = {
  modelId?: string;
  messages?: ChatBodyMessage[];
  maxTokens?: number;
  systemExtra?: string;
  systemOverride?: string;
  reasoningPhase?: ReasoningPhase;
  /** клиент сообщает режим рассуждений — стоимость считает сервер */
  reasoning?: boolean;
  /** включить coding tools песочницы */
  codingTools?: boolean;
  /** веб-поиск / чтение сайтов (по умолчанию вкл) */
  webTools?: boolean;
  /** не списывать кредиты (промежуточный tool-раунд) */
  skipCharge?: boolean;
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
    const MAX = 1_200_000;
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

function normalizeHistory(messages: ChatBodyMessage[] | undefined, allowTools: boolean) {
  const raw = messages ?? [];
  const mapped = raw
    .filter((m) => m && typeof m === 'object')
    .map((m) => {
      const role = m.role;
      if (role === 'user' || role === 'assistant') {
        const out: Record<string, unknown> = {
          role,
          content: typeof m.content === 'string' ? m.content.slice(0, 12000) : m.content ?? '',
        };
        if (allowTools && Array.isArray(m.tool_calls) && m.tool_calls.length) {
          out.tool_calls = m.tool_calls.slice(0, 8).map((tc) => ({
            id: String(tc.id || '').slice(0, 80),
            type: 'function',
            function: {
              name: String(tc.function?.name || '').slice(0, 64),
              arguments: String(tc.function?.arguments || '').slice(0, 100_000),
            },
          }));
        }
        return out;
      }
      if (allowTools && role === 'tool') {
        return {
          role: 'tool',
          tool_call_id: String(m.tool_call_id || '').slice(0, 80),
          name: m.name ? String(m.name).slice(0, 64) : undefined,
          content: typeof m.content === 'string' ? m.content.slice(0, 80_000) : '',
        };
      }
      return null;
    })
    .filter(Boolean) as Record<string, unknown>[];

  return mapped.slice(-36);
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
    const codingTools = body.codingTools === true;
    const webTools = body.webTools !== false;
    const phase =
      body.reasoningPhase === 'think' || body.reasoningPhase === 'answer'
        ? body.reasoningPhase
        : undefined;
    /** web/coding tools; на шаге think выключены */
    const allowTools = phase !== 'think' && (webTools || codingTools);
    const history = normalizeHistory(body.messages, allowTools);

    if (!history.length) {
      sendJson(res, 400, { error: 'Нет сообщений' });
      return;
    }

    // Шаг think / промежуточные tool-раунды не списываем отдельно
    const chargeNow = phase !== 'think' && body.skipCharge !== true;

    const idToken = bearerToken(req);
    const maint = await getMaintenanceBlock({ idToken });
    if (maint.blocked) {
      sendJson(res, 503, { error: maint.reason || 'Технические работы' });
      return;
    }

    const gateResult = await assertCanGenerate({
      idToken,
      ip,
      modelId,
      reasoning: body.reasoning === true,
    });

    if (!gateResult.ok) {
      sendJson(res, gateResult.status, { error: gateResult.error });
      return;
    }

    const { gate } = gateResult;
    const shouldCharge = chargeNow && !gate.isAdmin;

    if (shouldCharge && gate.limit != null && gate.used + gate.cost > gate.limit) {
      sendJson(res, 402, { error: 'Недостаточно кредитов' });
      return;
    }

    const maxTokens = maxTokensFor(gate, model.defaultMaxTokens);
    const systemExtra =
      typeof body.systemExtra === 'string' ? body.systemExtra.trim().slice(0, 2000) : '';
    const modelSystemExtra = await getModelSystemPrompt(modelId);

    const webOn = allowTools && webTools;
    const systemContent = buildSystemPrompt(modelId, systemExtra || null, {
      reasoningPhase: phase,
      modelSystemExtra: modelSystemExtra || null,
      codingTools,
      codingExtra: codingTools ? CODING_SYSTEM_EXTRA : null,
      webTools: webOn,
      webExtra: webOn ? WEB_SYSTEM_EXTRA : NO_WEB_WEATHER_EXTRA,
    });

    const upstreamBody: Record<string, unknown> = {
      model: AITUNNEL_MODEL_ID,
      max_tokens: maxTokens,
      temperature: model.temperature,
      messages: [{ role: 'system', content: systemContent }, ...history],
    };

    if (allowTools) {
      upstreamBody.tools = buildToolList({ codingTools, webTools });
      upstreamBody.tool_choice = 'auto';
    }

    const upstream = await fetch('https://api.aitunnel.ru/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(upstreamBody),
    });

    const data = (await upstream.json().catch(() => null)) as {
      choices?: {
        message?: {
          content?: string | null;
          tool_calls?: ToolCallFn[];
        };
        finish_reason?: string;
      }[];
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

    const message = data?.choices?.[0]?.message;
    let toolCalls = Array.isArray(message?.tool_calls)
      ? message!.tool_calls!.slice(0, 8)
      : [];
    let content = (message?.content || '').trim();

    // Gemma и др. иногда пишут tool call текстом вместо API tool_calls
    if (!toolCalls.length && content) {
      const parsed = extractTextualToolCalls(content);
      if (parsed.tool_calls.length) {
        toolCalls = parsed.tool_calls;
        content = parsed.cleaned;
      } else if (parsed.cleaned !== content) {
        content = parsed.cleaned;
      }
    }

    if (!content && !toolCalls.length) {
      sendJson(res, 502, { error: 'Пустой ответ от AITUNNEL' });
      return;
    }

    // Списываем только финальный текстовый ответ без tool_calls
    const chargeThisRound = shouldCharge && toolCalls.length === 0;
    let usage = { used: gate.used, limit: gate.limit };
    if (chargeThisRound) {
      const tokensApprox = Math.ceil((content || '').length / 4);
      usage = await chargeAfterSuccess(gate, tokensApprox, ip);
    }

    sendJson(res, 200, {
      content: content || '',
      tool_calls: toolCalls.length ? toolCalls : undefined,
      modelId,
      usage: {
        used: usage.used,
        limit: usage.limit,
        cost: chargeThisRound ? gate.cost : 0,
        planId: gate.planId,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка прокси';
    sendJson(res, 500, { error: message });
  }
}
