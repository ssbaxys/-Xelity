/**
 * Публичное API:
 * - OpenAI-совместимый: /v1/chat/completions, /v1/models
 * - Anthropic-совместимый: /v1/messages
 * - Xelity Search / Weather
 */
import type { Request, Response } from 'express';
import { AITUNNEL_MODEL_ID, buildSystemPrompt } from './prompts';
import { normalizeModelId, getModel, MODELS } from '../src/lib/models';
import {
  chatUsdCostFromTokens,
  estimateTokensFromText,
  searchUsdCost,
  weatherUsdCost,
  formatUsd,
  API_USD,
} from '../src/lib/apiPricing';
import { authenticateApiKey, chargeUsd, getUsdBalance } from './apiKeys';
import { executeWebSearch } from './webTools';
import { executeGetWeather } from './weatherTools';
import { WEB_SYSTEM_EXTRA } from './tools';

function cors(res: Response) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, x-api-key, anthropic-version',
  );
}

function apiKeyFromReq(req: Request): string {
  const h = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  if (m?.[1]) return m[1].trim();
  const x = req.headers['x-api-key'];
  if (typeof x === 'string' && x.trim()) return x.trim();
  return '';
}

async function requireKey(req: Request, res: Response) {
  cors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return null;
  }
  const raw = apiKeyFromReq(req);
  if (!raw) {
    res.status(401).json({
      error: { message: 'Missing API key (Authorization: Bearer or x-api-key)', type: 'auth_error' },
    });
    return null;
  }
  const auth = await authenticateApiKey(raw);
  if (!auth) {
    res.status(401).json({ error: { message: 'Invalid or revoked API key', type: 'auth_error' } });
    return null;
  }
  return auth;
}

function anthropicText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return String(content ?? '');
  return content
    .map((block) => {
      if (!block || typeof block !== 'object') return '';
      const b = block as { type?: string; text?: string };
      if (b.type === 'text' && typeof b.text === 'string') return b.text;
      return '';
    })
    .filter(Boolean)
    .join('\n');
}

type ChatRunOk = {
  content: string;
  modelId: string;
  promptTokens: number;
  completionTokens: number;
  billed: number;
  balance: number;
  finishReason: string;
};

async function runXlaudeChat(opts: {
  uid: string;
  modelId: string;
  messages: { role: string; content: string }[];
  maxTokens: number;
  temperature: number;
  reasoning: boolean;
  extraSystem?: string;
}): Promise<{ ok: true; data: ChatRunOk } | { ok: false; status: number; error: object }> {
  const apiKey = process.env.AITUNNEL_API_KEY || '';
  if (!apiKey) {
    return {
      ok: false,
      status: 503,
      error: { error: { message: 'Upstream not configured', type: 'server_error' } },
    };
  }

  const model = getModel(opts.modelId);
  const systemContent = [
    buildSystemPrompt(opts.modelId, null, {
      webTools: true,
      webExtra: WEB_SYSTEM_EXTRA,
    }),
    opts.extraSystem?.trim() || '',
  ]
    .filter(Boolean)
    .join('\n\n');

  const maxTokens = Math.min(
    Math.max(16, opts.maxTokens || model.defaultMaxTokens),
    model.defaultMaxTokens,
  );

  const promptEst = estimateTokensFromText(
    [systemContent, ...opts.messages.map((m) => m.content)].join('\n'),
  );
  const estCost = chatUsdCostFromTokens(opts.modelId, promptEst, maxTokens, opts.reasoning);
  const bal = await getUsdBalance(opts.uid);
  if (bal < 0.01) {
    return {
      ok: false,
      status: 402,
      error: {
        error: {
          message: `Insufficient USD balance (have ${formatUsd(bal)}). Top up to use the API.`,
          type: 'billing_error',
        },
      },
    };
  }
  if (bal + 1e-9 < estCost) {
    return {
      ok: false,
      status: 402,
      error: {
        error: {
          message: `Insufficient USD balance (est. ${formatUsd(estCost)}, have ${formatUsd(bal)})`,
          type: 'billing_error',
        },
      },
    };
  }

  try {
    const upstream = await fetch('https://api.aitunnel.ru/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: AITUNNEL_MODEL_ID,
        max_tokens: maxTokens,
        temperature: opts.temperature,
        messages: [{ role: 'system', content: systemContent }, ...opts.messages],
      }),
    });
    const data = (await upstream.json().catch(() => null)) as {
      choices?: { message?: { content?: string }; finish_reason?: string }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
      error?: { message?: string };
    };

    if (!upstream.ok) {
      return {
        ok: false,
        status: upstream.status >= 400 ? upstream.status : 502,
        error: {
          error: {
            message: data?.error?.message || 'Upstream error',
            type: 'upstream_error',
          },
        },
      };
    }

    const content = data?.choices?.[0]?.message?.content || '';
    const promptTokens =
      typeof data?.usage?.prompt_tokens === 'number' && data.usage.prompt_tokens >= 0
        ? data.usage.prompt_tokens
        : promptEst;
    const completionTokens =
      typeof data?.usage?.completion_tokens === 'number' && data.usage.completion_tokens >= 0
        ? data.usage.completion_tokens
        : estimateTokensFromText(content);

    const cost = chatUsdCostFromTokens(
      opts.modelId,
      promptTokens,
      completionTokens,
      opts.reasoning,
    );
    const billed = Math.max(0.01, Math.round(cost * 100) / 100);

    const charged = await chargeUsd(opts.uid, billed, {
      product: 'chat',
      detail: `${opts.modelId}${opts.reasoning ? '+reasoning' : ''} · ${promptTokens}+${completionTokens} tok`,
    });
    if (!charged.ok) {
      return {
        ok: false,
        status: 402,
        error: {
          error: {
            message: `${charged.error} (need ${formatUsd(billed)})`,
            type: 'billing_error',
          },
        },
      };
    }

    return {
      ok: true,
      data: {
        content,
        modelId: opts.modelId,
        promptTokens,
        completionTokens,
        billed,
        balance: charged.balance,
        finishReason: data?.choices?.[0]?.finish_reason || 'stop',
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Request failed';
    return {
      ok: false,
      status: 500,
      error: { error: { message: msg, type: 'server_error' } },
    };
  }
}

export async function handleV1Models(req: Request, res: Response) {
  cors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  res.json({
    object: 'list',
    data: MODELS.map((m) => ({
      id: m.id,
      object: 'model',
      owned_by: 'xelity',
      name: m.name,
      generation: m.generation,
      pricing: {
        inputPer1MUsd: API_USD.chatPer1M[m.id].input,
        outputPer1MUsd: API_USD.chatPer1M[m.id].output,
      },
    })),
    products: {
      chat_openai: 'POST /v1/chat/completions',
      chat_anthropic: 'POST /v1/messages',
      search: 'POST /v1/search',
      weather: 'POST /v1/weather',
    },
  });
}

export async function handleV1ChatCompletions(req: Request, res: Response) {
  const auth = await requireKey(req, res);
  if (!auth) return;

  const body = req.body as {
    model?: string;
    messages?: { role?: string; content?: string }[];
    max_tokens?: number;
    temperature?: number;
    reasoning?: boolean;
  };

  const modelId = normalizeModelId(body.model || 'xlaude-mini-k1');
  const model = getModel(modelId);
  const reasoning = body.reasoning === true;

  const messages = Array.isArray(body.messages)
    ? body.messages
        .filter((m) => m && (m.role === 'user' || m.role === 'assistant' || m.role === 'system'))
        .map((m) => ({
          role: m.role as string,
          content: String(m.content || '').slice(0, 100_000),
        }))
        .slice(-40)
    : [];
  if (!messages.length) {
    res.status(400).json({ error: { message: 'messages required', type: 'invalid_request' } });
    return;
  }

  const result = await runXlaudeChat({
    uid: auth.uid,
    modelId,
    messages,
    maxTokens: Number(body.max_tokens) || model.defaultMaxTokens,
    temperature:
      typeof body.temperature === 'number' ? body.temperature : model.temperature,
    reasoning,
  });

  if (!result.ok) {
    res.status(result.status).json(result.error);
    return;
  }

  const d = result.data;
  res.json({
    id: `chatcmpl_${Date.now().toString(36)}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: d.modelId,
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: d.content },
        finish_reason: d.finishReason,
      },
    ],
    usage: {
      prompt_tokens: d.promptTokens,
      completion_tokens: d.completionTokens,
      total_tokens: d.promptTokens + d.completionTokens,
    },
    xelity: {
      product: 'chat',
      billedUsd: d.billed,
      balanceUsd: d.balance,
      prompt_tokens: d.promptTokens,
      completion_tokens: d.completionTokens,
    },
  });
}

/** Anthropic Messages API shape → те же модели Xlaude */
export async function handleV1Messages(req: Request, res: Response) {
  const auth = await requireKey(req, res);
  if (!auth) return;

  const body = req.body as {
    model?: string;
    messages?: { role?: string; content?: unknown }[];
    system?: string | { type?: string; text?: string }[];
    max_tokens?: number;
    temperature?: number;
    metadata?: { reasoning?: boolean };
  };

  const modelId = normalizeModelId(body.model || 'xlaude-mini-k1');
  const model = getModel(modelId);
  const reasoning = body.metadata?.reasoning === true;

  let systemExtra = '';
  if (typeof body.system === 'string') {
    systemExtra = body.system;
  } else if (Array.isArray(body.system)) {
    systemExtra = body.system
      .map((b) => (typeof b?.text === 'string' ? b.text : ''))
      .filter(Boolean)
      .join('\n');
  }

  const messages = Array.isArray(body.messages)
    ? body.messages
        .filter((m) => m && (m.role === 'user' || m.role === 'assistant'))
        .map((m) => ({
          role: m.role as string,
          content: anthropicText(m.content).slice(0, 100_000),
        }))
        .filter((m) => m.content.trim())
        .slice(-40)
    : [];

  if (!messages.length) {
    res.status(400).json({
      type: 'error',
      error: { type: 'invalid_request_error', message: 'messages required' },
    });
    return;
  }

  if (typeof body.max_tokens !== 'number' || !(body.max_tokens > 0)) {
    res.status(400).json({
      type: 'error',
      error: { type: 'invalid_request_error', message: 'max_tokens is required' },
    });
    return;
  }

  const result = await runXlaudeChat({
    uid: auth.uid,
    modelId,
    messages,
    maxTokens: body.max_tokens,
    temperature:
      typeof body.temperature === 'number' ? body.temperature : model.temperature,
    reasoning,
    extraSystem: systemExtra,
  });

  if (!result.ok) {
    const errBody = result.error as { error?: { message?: string; type?: string } };
    res.status(result.status).json({
      type: 'error',
      error: {
        type: errBody.error?.type || 'api_error',
        message: errBody.error?.message || 'Request failed',
      },
    });
    return;
  }

  const d = result.data;
  res.json({
    id: `msg_${Date.now().toString(36)}`,
    type: 'message',
    role: 'assistant',
    model: d.modelId,
    content: [{ type: 'text', text: d.content }],
    stop_reason: d.finishReason === 'length' ? 'max_tokens' : 'end_turn',
    stop_sequence: null,
    usage: {
      input_tokens: d.promptTokens,
      output_tokens: d.completionTokens,
    },
    xelity: {
      product: 'chat',
      billedUsd: d.billed,
      balanceUsd: d.balance,
    },
  });
}

/** Xelity Search */
export async function handleV1Search(req: Request, res: Response) {
  const auth = await requireKey(req, res);
  if (!auth) return;

  const body = req.body as { query?: string; q?: string; images?: boolean };
  const query = String(body.query || body.q || '').trim();
  if (!query) {
    res.status(400).json({ error: { message: 'query required', type: 'invalid_request' } });
    return;
  }
  const images = body.images === true;
  const cost = searchUsdCost(images);
  const bal = await getUsdBalance(auth.uid);
  if (bal < cost) {
    res.status(402).json({
      error: {
        message: `Insufficient USD (need ${formatUsd(cost)})`,
        type: 'billing_error',
      },
    });
    return;
  }

  const result = await executeWebSearch(query, { images });
  if (!result.ok) {
    res.status(502).json({
      error: { message: result.error || 'Search failed', type: 'search_error' },
      product: 'Xelity Search',
    });
    return;
  }

  const charged = await chargeUsd(auth.uid, cost, {
    product: 'xelity_search',
    detail: images ? 'images' : 'web',
  });
  if (!charged.ok) {
    res.status(402).json({ error: { message: charged.error, type: 'billing_error' } });
    return;
  }

  res.json({
    product: 'Xelity Search',
    object: 'xelity.search',
    query: result.query || query,
    results: (result.links || []).map((l) => ({
      title: l.title,
      url: l.url,
      snippet: l.snippet,
      image: l.image,
    })),
    xelity: {
      billedUsd: cost,
      balanceUsd: charged.balance,
    },
  });
}

/** Xelity Weather */
export async function handleV1Weather(req: Request, res: Response) {
  const auth = await requireKey(req, res);
  if (!auth) return;

  const body = req.body as {
    location?: string;
    latitude?: number;
    longitude?: number;
    days?: number;
  };
  const cost = weatherUsdCost();
  const bal = await getUsdBalance(auth.uid);
  if (bal < cost) {
    res.status(402).json({
      error: {
        message: `Insufficient USD (need ${formatUsd(cost)})`,
        type: 'billing_error',
      },
    });
    return;
  }

  const result = await executeGetWeather({
    location: body.location,
    latitude: body.latitude,
    longitude: body.longitude,
    days: body.days,
  });
  if (!result.ok || !result.weather) {
    res.status(502).json({
      error: { message: result.error || 'Weather failed', type: 'weather_error' },
      product: 'Xelity Weather',
    });
    return;
  }

  const charged = await chargeUsd(auth.uid, cost, {
    product: 'xelity_weather',
    detail: result.weather.place,
  });
  if (!charged.ok) {
    res.status(402).json({ error: { message: charged.error, type: 'billing_error' } });
    return;
  }

  res.json({
    product: 'Xelity Weather',
    object: 'xelity.weather',
    weather: result.weather,
    xelity: {
      billedUsd: cost,
      balanceUsd: charged.balance,
    },
  });
}
