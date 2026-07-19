import type { IncomingMessage, ServerResponse } from 'http';
import { CODING_TOOL_NAMES, WEB_TOOL_NAMES } from './tools';
import { runWebTool } from './webTools';

function sendJson(res: ServerResponse, status: number, payload: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

type ToolBody = {
  name?: string;
  arguments?: string | Record<string, unknown>;
};

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

function readJsonBody(req: IncomingMessage): Promise<ToolBody> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    const MAX = 200_000;
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
        resolve(JSON.parse(raw) as ToolBody);
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

export async function handleToolExecute(req: IncomingMessage, res: ServerResponse) {
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

  try {
    const body = await readJsonBody(req);
    const name = String(body.name || '').trim().slice(0, 64);
    if (!name) {
      sendJson(res, 400, { error: 'name обязателен' });
      return;
    }

    if (CODING_TOOL_NAMES.has(name)) {
      sendJson(res, 400, {
        error: 'Coding tools выполняются на клиенте',
      });
      return;
    }

    if (!WEB_TOOL_NAMES.has(name)) {
      sendJson(res, 400, { error: `Неизвестный tool: ${name}` });
      return;
    }

    const args =
      typeof body.arguments === 'string'
        ? body.arguments
        : JSON.stringify(body.arguments ?? {});

    const result = await runWebTool(name, args);
    sendJson(res, 200, {
      ok: result.ok,
      content: result.forModel,
      summary: result.summary,
      error: result.error,
      title: result.title,
      url: result.url,
      query: result.query,
      links: result.links,
      weather: result.weather,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Ошибка tool';
    sendJson(res, 500, { error: message });
  }
}
