/**
 * Публичное API: /v1/chat/completions, /v1/search (Xelity Search), /v1/weather (Xelity Weather)
 */
import type { Request, Response } from 'express';
import { AITUNNEL_MODEL_ID, buildSystemPrompt } from './prompts';
import { normalizeModelId, getModel } from '../src/lib/models';
import { chatUsdCost, searchUsdCost, weatherUsdCost, formatUsd } from '../src/lib/apiPricing';
import { authenticateApiKey, chargeUsd, getUsdBalance } from './apiKeys';
import { executeWebSearch } from './webTools';
import { executeGetWeather } from './weatherTools';
import { WEB_SYSTEM_EXTRA } from './tools';

function cors(res: Response) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function bearer(req: Request): string {
  const h = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m?.[1]?.trim() || '';
}

async function requireKey(req: Request, res: Response) {
  cors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return null;
  }
  const raw = bearer(req);
  if (!raw) {
    res.status(401).json({ error: { message: 'Missing Bearer API key', type: 'auth_error' } });
    return null;
  }
  const auth = await authenticateApiKey(raw);
  if (!auth) {
    res.status(401).json({ error: { message: 'Invalid or revoked API key', type: 'auth_error' } });
    return null;
  }
  return auth;
}

export async function handleV1Models(req: Request, res: Response) {
  cors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  res.json({
    object: 'list',
    data: [
      { id: 'xlaude-mini-k1', object: 'model', owned_by: 'xelity' },
      { id: 'xlaude-pro-k1', object: 'model', owned_by: 'xelity' },
      { id: 'xlaude-mini-k2', object: 'model', owned_by: 'xelity' },
      { id: 'xlaude-pro-k2', object: 'model', owned_by: 'xelity' },
    ],
    products: {
      chat: 'Xlaude models via /v1/chat/completions',
      search: 'Xelity Search via /v1/search',
      weather: 'Xelity Weather via /v1/weather',
    },
  });
}

export async function handleV1ChatCompletions(req: Request, res: Response) {
  const auth = await requireKey(req, res);
  if (!auth) return;

  const apiKey = process.env.AITUNNEL_API_KEY || '';
  if (!apiKey) {
    res.status(503).json({ error: { message: 'Upstream not configured', type: 'server_error' } });
    return;
  }

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
  const cost = chatUsdCost(modelId, reasoning);
  const bal = await getUsdBalance(auth.uid);
  if (bal < cost) {
    res.status(402).json({
      error: {
        message: `Insufficient USD balance (need ${formatUsd(cost)}, have ${formatUsd(bal)})`,
        type: 'billing_error',
      },
    });
    return;
  }

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

  const systemContent = buildSystemPrompt(modelId, null, {
    webTools: true,
    webExtra: WEB_SYSTEM_EXTRA,
  });

  const maxTokens = Math.min(
    Math.max(16, Number(body.max_tokens) || model.defaultMaxTokens),
    model.defaultMaxTokens,
  );

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
        temperature:
          typeof body.temperature === 'number' ? body.temperature : model.temperature,
        messages: [{ role: 'system', content: systemContent }, ...messages],
      }),
    });
    const data = (await upstream.json().catch(() => null)) as {
      choices?: { message?: { content?: string }; finish_reason?: string }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
      error?: { message?: string };
    };

    if (!upstream.ok) {
      res.status(upstream.status >= 400 ? upstream.status : 502).json({
        error: {
          message: data?.error?.message || 'Upstream error',
          type: 'upstream_error',
        },
      });
      return;
    }

    const charged = await chargeUsd(auth.uid, cost, {
      product: 'chat',
      detail: `${modelId}${reasoning ? '+reasoning' : ''}`,
    });
    if (!charged.ok) {
      res.status(402).json({
        error: { message: charged.error, type: 'billing_error' },
      });
      return;
    }

    const content = data?.choices?.[0]?.message?.content || '';
    res.json({
      id: `chatcmpl_${Date.now().toString(36)}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: modelId,
      choices: [
        {
          index: 0,
          message: { role: 'assistant', content },
          finish_reason: data?.choices?.[0]?.finish_reason || 'stop',
        },
      ],
      usage: data?.usage || {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      },
      xelity: {
        product: 'chat',
        billedUsd: cost,
        balanceUsd: charged.balance,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Request failed';
    res.status(500).json({ error: { message: msg, type: 'server_error' } });
  }
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
