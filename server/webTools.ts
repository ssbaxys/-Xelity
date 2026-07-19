/**
 * Агентские web-tools: поиск (SearXNG) и чтение страниц.
 * Выполняются только на VPS — клиент вызывает /api/tools.
 */

const SEARXNG_URL = (process.env.SEARXNG_URL || 'http://127.0.0.1:8888').replace(/\/$/, '');
const FETCH_TIMEOUT_MS = 12_000;
const SEARCH_TIMEOUT_MS = 10_000;
const MAX_FETCH_BYTES = 1_500_000;
const MAX_TEXT_CHARS = 24_000;

export type WebToolLink = {
  title: string;
  url: string;
  snippet?: string;
};

export type WebToolResult = {
  ok: boolean;
  forModel: string;
  summary?: string;
  error?: string;
  title?: string;
  url?: string;
  query?: string;
  links?: WebToolLink[];
};

function isPrivateHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, '');
  if (
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '0.0.0.0' ||
    h === '::1' ||
    h.endsWith('.local') ||
    h.endsWith('.internal') ||
    h.endsWith('.localhost')
  ) {
    return true;
  }
  // IPv4 private / link-local / metadata
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  }
  return false;
}

export function assertSafePublicUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error('Некорректный URL');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new Error('Разрешены только http/https');
  }
  if (u.username || u.password) {
    throw new Error('URL с учётными данными запрещён');
  }
  if (isPrivateHostname(u.hostname)) {
    throw new Error('Доступ к локальным/приватным адресам запрещён');
  }
  return u;
}

function htmlToText(html: string): { title: string; text: string } {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch
    ? titleMatch[1].replace(/\s+/g, ' ').trim().slice(0, 300)
    : '';
  const descMatch =
    html.match(
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
    ) ||
    html.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i,
    );
  const description = descMatch?.[1]?.replace(/\s+/g, ' ').trim() || '';

  let body = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');

  body = body
    .replace(/<\/(p|div|h[1-6]|li|tr|br|section|article)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

  const parts = [title && `Title: ${title}`, description && `Description: ${description}`, body]
    .filter(Boolean)
    .join('\n\n');

  return { title, text: parts.slice(0, MAX_TEXT_CHARS) };
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

export async function executeWebSearch(query: string): Promise<WebToolResult> {
  const q = query.trim().slice(0, 300);
  if (!q) {
    return { ok: false, forModel: 'Error: empty query', error: 'Пустой запрос', query: q };
  }

  try {
    const url = `${SEARXNG_URL}/search?${new URLSearchParams({
      q,
      format: 'json',
      language: 'auto',
    })}`;
    const res = await fetchWithTimeout(
      url,
      {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'XelityAgent/1.0',
        },
      },
      SEARCH_TIMEOUT_MS,
    );

    if (!res.ok) {
      const err = `SearXNG HTTP ${res.status}`;
      return {
        ok: false,
        forModel: `Search failed: ${err}. SearXNG may be starting — retry shortly.`,
        error: err,
        query: q,
      };
    }

    const data = (await res.json()) as {
      results?: { title?: string; url?: string; content?: string; engine?: string }[];
      number_of_results?: number;
    };

    const results = (data.results || []).slice(0, 8).map((r, i) => ({
      n: i + 1,
      title: (r.title || '').slice(0, 200),
      url: (r.url || '').slice(0, 500),
      snippet: (r.content || '').slice(0, 400),
      engine: r.engine,
    }));

    if (!results.length) {
      return {
        ok: true,
        forModel: `No results for: ${q}`,
        summary: 'Ничего не найдено',
        query: q,
        links: [],
      };
    }

    const links = results.map((r) => ({
      title: r.title || r.url,
      url: r.url,
      snippet: r.snippet || undefined,
    }));

    const forModel = [
      `Search results for: ${q}`,
      ...results.map(
        (r) =>
          `${r.n}. ${r.title}\n   URL: ${r.url}\n   ${r.snippet || '(no snippet)'}`,
      ),
      '',
      'If you need full page text, call web_fetch on a promising URL.',
    ].join('\n');

    return {
      ok: true,
      forModel: forModel.slice(0, 40_000),
      summary: `${results.length} результатов`,
      query: q,
      links,
    };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.name === 'AbortError'
          ? 'Таймаут SearXNG'
          : err.message
        : 'Ошибка поиска';
    return {
      ok: false,
      forModel: `Search failed: ${message}. Is SearXNG running at ${SEARXNG_URL}?`,
      error: message,
      query: q,
    };
  }
}

export async function executeWebFetch(rawUrl: string): Promise<WebToolResult> {
  let safe: URL;
  try {
    safe = assertSafePublicUrl(rawUrl.trim().slice(0, 2000));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Bad URL';
    return { ok: false, forModel: `Fetch failed: ${message}`, error: message, url: rawUrl };
  }

  try {
    const res = await fetchWithTimeout(
      safe.toString(),
      {
        redirect: 'follow',
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5',
          'User-Agent':
            'Mozilla/5.0 (compatible; XelityBot/1.0; +https://xelity.ru)',
        },
      },
      FETCH_TIMEOUT_MS,
    );

    // block redirects to private hosts
    try {
      assertSafePublicUrl(res.url);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unsafe redirect';
      return {
        ok: false,
        forModel: `Fetch failed: ${message}`,
        error: message,
        url: safe.toString(),
      };
    }

    if (!res.ok) {
      return {
        ok: false,
        forModel: `Fetch failed: HTTP ${res.status} for ${safe}`,
        error: `HTTP ${res.status}`,
        url: safe.toString(),
      };
    }

    const ctype = (res.headers.get('content-type') || '').toLowerCase();
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > MAX_FETCH_BYTES) {
      return {
        ok: false,
        forModel: `Fetch failed: response too large (${buf.length} bytes)`,
        error: 'Слишком большой ответ',
        url: safe.toString(),
      };
    }

    const raw = buf.toString('utf8');
    if (
      ctype.includes('application/json') ||
      (!ctype.includes('html') && raw.trimStart().startsWith('{'))
    ) {
      const text = raw.slice(0, MAX_TEXT_CHARS);
      return {
        ok: true,
        forModel: `URL: ${res.url}\nContent-Type: ${ctype || 'unknown'}\n\n${text}`,
        summary: 'JSON/текст',
        url: res.url,
        title: 'JSON',
      };
    }

    if (ctype.includes('text/plain') || (!ctype.includes('html') && !ctype.includes('xml'))) {
      return {
        ok: true,
        forModel: `URL: ${res.url}\nContent-Type: ${ctype || 'unknown'}\n\n${raw.slice(0, MAX_TEXT_CHARS)}`,
        summary: 'Текст',
        url: res.url,
      };
    }

    const { title, text } = htmlToText(raw);
    return {
      ok: true,
      forModel: `URL: ${res.url}\nTitle: ${title || '(none)'}\n\n${text}`,
      summary: title || 'Страница прочитана',
      url: res.url,
      title,
    };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.name === 'AbortError'
          ? 'Таймаут загрузки'
          : err.message
        : 'Ошибка загрузки';
    return {
      ok: false,
      forModel: `Fetch failed: ${message}`,
      error: message,
      url: safe.toString(),
    };
  }
}

export async function runWebTool(
  name: string,
  argsJson: string,
): Promise<WebToolResult> {
  let args: Record<string, unknown> = {};
  try {
    args = JSON.parse(argsJson || '{}') as Record<string, unknown>;
  } catch {
    return { ok: false, forModel: 'Error: invalid JSON arguments', error: 'Неверный JSON' };
  }

  if (name === 'web_search') {
    return executeWebSearch(String(args.query ?? args.q ?? ''));
  }
  if (name === 'web_fetch') {
    return executeWebFetch(String(args.url ?? args.href ?? ''));
  }
  return {
    ok: false,
    forModel: `Unknown web tool: ${name}`,
    error: 'Неизвестный tool',
  };
}
