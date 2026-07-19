/**
 * Агентские web-tools: поиск (SearXNG → fallback), чтение страниц, погода (Open-Meteo).
 * Выполняются только на VPS — клиент вызывает /api/tools.
 */

import { executeGetWeather, type WeatherPayload } from './weatherTools';

const SEARXNG_URL = (process.env.SEARXNG_URL || 'http://127.0.0.1:8888').replace(/\/$/, '');
const FETCH_TIMEOUT_MS = 12_000;
const SEARCH_TIMEOUT_MS = 10_000;
const MAX_FETCH_BYTES = 1_500_000;
/** лимит текста одной страницы в tool-результате (экономия токенов AITunnel) */
const MAX_TEXT_CHARS = 14_000;
const MAX_FETCH_URLS = 5;
const MAX_BATCH_TOTAL_CHARS = 36_000;

export type WebToolLink = {
  title: string;
  url: string;
  snippet?: string;
  /** прямая ссылка на изображение (SearXNG img_src / thumbnail) */
  image?: string;
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
  weather?: WeatherPayload;
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
  const m = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true;
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

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();
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

function errMessage(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback;
  if (err.name === 'AbortError') return 'таймаут';
  const m = err.message || fallback;
  if (/fetch failed|econnrefused|enotfound|network/i.test(m)) {
    return 'нет соединения';
  }
  return m;
}

function packResults(
  q: string,
  links: WebToolLink[],
  source: string,
  opts?: { images?: boolean },
): WebToolResult {
  if (!links.length) {
    return {
      ok: true,
      forModel: `No results for: ${q} (via ${source})`,
      summary: 'Ничего не найдено',
      query: q,
      links: [],
    };
  }
  const withImages = links.filter((l) => l.image);
  const forModel = [
    opts?.images
      ? `IMAGE SEARCH RESULTS for: ${q}`
      : `SEARCH RESULTS (titles + snippets only — NOT full pages) for: ${q}`,
    `Source: ${source}`,
    '',
    ...links.map((r, i) => {
      const lines = [
        `[${i + 1}] ${r.title}`,
        `    URL: ${r.url}`,
        `    Snippet: ${r.snippet || '(no snippet)'}`,
      ];
      if (r.image) {
        lines.push(`    IMAGE: ${r.image}`);
      }
      return lines.join('\n');
    }),
    '',
    'NEXT STEP (save tokens):',
    '- If snippets already answer the user — reply NOW, do NOT call web_fetch.',
    '- Else call web_fetch with the best 1–3 URLs (or urls:[...] up to 5).',
    '- Fetch all results only if the task truly needs every source.',
    '',
    'IMAGES IN YOUR REPLY (optional):',
    '- If a result has IMAGE: … you MAY embed it for the user with this exact block:',
    '  [[img: Title | IMAGE_URL | PAGE_URL]]',
    '- UI shows the picture, title, and a link to the source root only (https://domain/).',
    '- Use ONLY real IMAGE/URL from this list. Max 4 images per answer.',
    withImages.length
      ? `- ${withImages.length} result(s) include IMAGE urls.`
      : '- No IMAGE urls in this batch — call web_search with images:true if the user wants pictures.',
  ].join('\n');
  return {
    ok: true,
    forModel: forModel.slice(0, 40_000),
    summary: `${links.length} · ${source}${opts?.images ? ' · img' : ''}`,
    query: q,
    links,
  };
}

function pickImageUrl(r: {
  img_src?: string;
  thumbnail?: string;
  thumbnail_src?: string;
  url?: string;
}): string | undefined {
  for (const cand of [r.img_src, r.thumbnail_src, r.thumbnail]) {
    if (typeof cand === 'string' && /^https?:\/\//i.test(cand)) {
      return cand.slice(0, 2000);
    }
  }
  return undefined;
}

async function searchSearxng(
  q: string,
  opts?: { images?: boolean },
): Promise<WebToolResult | null> {
  const bases = Array.from(
    new Set([SEARXNG_URL, 'http://127.0.0.1:8888', 'http://127.0.0.1:8080']),
  );

  let lastErr = '';
  for (const base of bases) {
    try {
      const params = new URLSearchParams({
        q,
        format: 'json',
        language: 'auto',
      });
      if (opts?.images) params.set('categories', 'images');
      const url = `${base}/search?${params}`;
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
        lastErr = `HTTP ${res.status}`;
        continue;
      }
      const ctype = (res.headers.get('content-type') || '').toLowerCase();
      if (!ctype.includes('json')) {
        lastErr = 'не JSON (format=json выключен?)';
        continue;
      }
      const data = (await res.json()) as {
        results?: {
          title?: string;
          url?: string;
          content?: string;
          img_src?: string;
          thumbnail?: string;
          thumbnail_src?: string;
        }[];
      };
      const links: WebToolLink[] = (data.results || [])
        .filter((r) => r.url || r.img_src)
        .slice(0, opts?.images ? 10 : 8)
        .map((r) => {
          const pageUrl = String(r.url || r.img_src || '').slice(0, 500);
          const image = pickImageUrl(r);
          return {
            title: (r.title || pageUrl || 'Image').slice(0, 200),
            url: pageUrl,
            snippet: (r.content || '').slice(0, 400) || undefined,
            image,
          };
        })
        .filter((l) => l.url && (!opts?.images || l.image));
      return packResults(q, links, opts?.images ? 'SearXNG images' : 'SearXNG', {
        images: opts?.images,
      });
    } catch (err) {
      lastErr = errMessage(err, 'ошибка');
    }
  }
  return {
    ok: false,
    forModel: `SearXNG unavailable (${lastErr}) at ${SEARXNG_URL}`,
    error: `SearXNG: ${lastErr}`,
    query: q,
  };
}

/** Fallback без Docker — HTML-выдача DuckDuckGo */
async function searchDuckDuckGo(q: string): Promise<WebToolResult | null> {
  try {
    const url = `https://html.duckduckgo.com/html/?${new URLSearchParams({ q })}`;
    const res = await fetchWithTimeout(
      url,
      {
        headers: {
          Accept: 'text/html',
          'User-Agent':
            'Mozilla/5.0 (compatible; XelityBot/1.0; +https://xelity.ru)',
        },
        redirect: 'follow',
      },
      SEARCH_TIMEOUT_MS,
    );
    if (!res.ok) {
      return {
        ok: false,
        forModel: `DuckDuckGo HTTP ${res.status}`,
        error: `DDG HTTP ${res.status}`,
        query: q,
      };
    }
    const html = await res.text();
    const links: WebToolLink[] = [];
    const re =
      /<a[^>]+class="[^"]*result__a[^"]*"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) && links.length < 8) {
      let href = decodeHtmlEntities(m[1]);
      // DDG sometimes wraps redirects
      const uddg = href.match(/[?&]uddg=([^&]+)/);
      if (uddg) {
        try {
          href = decodeURIComponent(uddg[1]);
        } catch {
          /* keep */
        }
      }
      if (!/^https?:\/\//i.test(href)) continue;
      const title = decodeHtmlEntities(m[2].replace(/<[^>]+>/g, ''));
      if (!title) continue;
      // snippet: nearest result__snippet after this match
      const after = html.slice(m.index, m.index + 1200);
      const snipM = after.match(/class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/(?:a|td|div)/i);
      const snippet = snipM
        ? decodeHtmlEntities(snipM[1].replace(/<[^>]+>/g, '')).slice(0, 400)
        : undefined;
      links.push({ title: title.slice(0, 200), url: href.slice(0, 500), snippet });
    }
    if (!links.length) {
      return {
        ok: false,
        forModel: 'DuckDuckGo: empty parse',
        error: 'DDG: пустая выдача',
        query: q,
      };
    }
    return packResults(q, links, 'DuckDuckGo');
  } catch (err) {
    return {
      ok: false,
      forModel: `DuckDuckGo failed: ${errMessage(err, 'ошибка')}`,
      error: `DDG: ${errMessage(err, 'ошибка')}`,
      query: q,
    };
  }
}

/** Ещё один fallback — Wikipedia OpenSearch */
async function searchWikipedia(q: string): Promise<WebToolResult | null> {
  try {
    const langs = ['ru', 'en'];
    const links: WebToolLink[] = [];
    for (const lang of langs) {
      if (links.length >= 8) break;
      const url = `https://${lang}.wikipedia.org/w/api.php?${new URLSearchParams({
        action: 'opensearch',
        search: q,
        limit: '5',
        namespace: '0',
        format: 'json',
      })}`;
      const res = await fetchWithTimeout(
        url,
        { headers: { Accept: 'application/json', 'User-Agent': 'XelityAgent/1.0' } },
        SEARCH_TIMEOUT_MS,
      );
      if (!res.ok) continue;
      const data = (await res.json()) as [string, string[], string[], string[]];
      const titles = data[1] || [];
      const descs = data[2] || [];
      const urls = data[3] || [];
      for (let i = 0; i < titles.length && links.length < 8; i++) {
        if (!urls[i]) continue;
        links.push({
          title: titles[i].slice(0, 200),
          url: urls[i].slice(0, 500),
          snippet: (descs[i] || '').slice(0, 400) || undefined,
        });
      }
    }
    if (!links.length) {
      return {
        ok: false,
        forModel: 'Wikipedia: no results',
        error: 'Wikipedia: пусто',
        query: q,
      };
    }
    return packResults(q, links, 'Wikipedia');
  } catch (err) {
    return {
      ok: false,
      forModel: `Wikipedia failed: ${errMessage(err, 'ошибка')}`,
      error: `Wiki: ${errMessage(err, 'ошибка')}`,
      query: q,
    };
  }
}

export async function executeWebSearch(
  query: string,
  opts?: { images?: boolean },
): Promise<WebToolResult> {
  const q = query.trim().slice(0, 300);
  if (!q) {
    return { ok: false, forModel: 'Error: empty query', error: 'Пустой запрос', query: q };
  }

  const attempts: string[] = [];

  const searx = await searchSearxng(q, opts);
  if (searx?.ok && (searx.links?.length || 0) > 0) return searx;
  if (searx?.error) attempts.push(searx.error);

  // картинки — только SearXNG; без Docker нет надёжного image API
  if (opts?.images) {
    return {
      ok: false,
      forModel: `Image search failed for: ${q}\n${attempts.join(' · ') || 'SearXNG unavailable'}\nHint: sudo ai-tool searxng`,
      error: (attempts[0] || 'Нет картинок').slice(0, 180),
      query: q,
    };
  }

  const ddg = await searchDuckDuckGo(q);
  if (ddg?.ok) return ddg;
  if (ddg?.error) attempts.push(ddg.error);

  const wiki = await searchWikipedia(q);
  if (wiki?.ok) return wiki;
  if (wiki?.error) attempts.push(wiki.error);

  const detail = attempts.filter(Boolean).join(' · ') || 'все источники недоступны';
  return {
    ok: false,
    forModel: `Search failed for: ${q}\nSources: ${detail}\nHint: on VPS run: sudo ai-tool searxng`,
    error: detail.slice(0, 180),
    query: q,
  };
}

async function fetchOnePage(
  rawUrl: string,
  textLimit: number,
): Promise<WebToolResult> {
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
    const limit = Math.max(2_000, Math.min(textLimit, MAX_TEXT_CHARS));

    if (
      ctype.includes('application/json') ||
      (!ctype.includes('html') && raw.trimStart().startsWith('{'))
    ) {
      const text = raw.slice(0, limit);
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
        forModel: `URL: ${res.url}\nContent-Type: ${ctype || 'unknown'}\n\n${raw.slice(0, limit)}`,
        summary: 'Текст',
        url: res.url,
      };
    }

    const { title, text } = htmlToText(raw);
    return {
      ok: true,
      forModel: `URL: ${res.url}\nTitle: ${title || '(none)'}\n\n${text.slice(0, limit)}`,
      summary: title || 'Страница прочитана',
      url: res.url,
      title,
    };
  } catch (err) {
    const message = errMessage(err, 'ошибка загрузки');
    return {
      ok: false,
      forModel: `Fetch failed: ${message}`,
      error: message,
      url: safe.toString(),
    };
  }
}

export async function executeWebFetch(rawUrl: string): Promise<WebToolResult> {
  return fetchOnePage(rawUrl, MAX_TEXT_CHARS);
}

/** Один или несколько URL (макс. MAX_FETCH_URLS) — для выборочного чтения после поиска */
export async function executeWebFetchMany(rawUrls: string[]): Promise<WebToolResult> {
  const unique: string[] = [];
  for (const u of rawUrls) {
    const s = String(u || '').trim();
    if (!s || unique.includes(s)) continue;
    unique.push(s);
    if (unique.length >= MAX_FETCH_URLS) break;
  }
  if (!unique.length) {
    return {
      ok: false,
      forModel: 'Fetch failed: no url / urls provided',
      error: 'Нужен url или urls',
    };
  }
  if (unique.length === 1) {
    return fetchOnePage(unique[0]!, MAX_TEXT_CHARS);
  }

  const perPage = Math.min(
    MAX_TEXT_CHARS,
    Math.floor(MAX_BATCH_TOTAL_CHARS / unique.length),
  );
  const parts: string[] = [
    `Fetched ${unique.length} pages (selected by you). Text page truncated to ~${perPage} chars.`,
    '',
  ];
  let okCount = 0;
  const links: WebToolLink[] = [];

  // параллельно, но с лимитом — быстрее один раунд для модели
  const results = await Promise.all(
    unique.map((u) => fetchOnePage(u, perPage)),
  );

  results.forEach((r, i) => {
    const requested = unique[i]!;
    if (r.ok) okCount += 1;
    links.push({
      title: r.title || requested,
      url: r.url || requested,
      snippet: r.ok ? undefined : r.error,
    });
    parts.push(`===== PAGE ${i + 1}/${unique.length} =====`);
    parts.push(r.forModel);
    parts.push('');
  });

  return {
    ok: okCount > 0,
    forModel: parts.join('\n').slice(0, MAX_BATCH_TOTAL_CHARS + 4_000),
    summary:
      okCount === unique.length
        ? `${okCount} стр.`
        : `${okCount}/${unique.length} стр.`,
    links,
    error: okCount === 0 ? 'Не удалось прочитать страницы' : undefined,
  };
}

function collectFetchUrls(args: Record<string, unknown>): string[] {
  const out: string[] = [];
  if (typeof args.url === 'string' && args.url.trim()) out.push(args.url.trim());
  if (typeof args.href === 'string' && args.href.trim()) out.push(args.href.trim());
  if (Array.isArray(args.urls)) {
    for (const u of args.urls) {
      if (typeof u === 'string' && u.trim()) out.push(u.trim());
    }
  }
  return out;
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
    const images =
      args.images === true ||
      args.images === 1 ||
      args.images === 'true' ||
      args.category === 'images' ||
      args.categories === 'images';
    return executeWebSearch(String(args.query ?? args.q ?? ''), { images });
  }
  if (name === 'web_fetch') {
    return executeWebFetchMany(collectFetchUrls(args));
  }
  if (name === 'get_weather') {
    const daysRaw = args.days;
    const days =
      typeof daysRaw === 'number'
        ? daysRaw
        : typeof daysRaw === 'string'
          ? Number(daysRaw)
          : undefined;
    const locRaw =
      (typeof args.location === 'string' && args.location) ||
      (typeof args.city === 'string' && args.city) ||
      (typeof args.place === 'string' && args.place) ||
      (typeof args.q === 'string' && args.q) ||
      '';
    const latRaw = args.latitude ?? args.lat;
    const lonRaw = args.longitude ?? args.lon ?? args.lng;
    const lat =
      typeof latRaw === 'number'
        ? latRaw
        : typeof latRaw === 'string'
          ? Number(latRaw)
          : undefined;
    const lon =
      typeof lonRaw === 'number'
        ? lonRaw
        : typeof lonRaw === 'string'
          ? Number(lonRaw)
          : undefined;
    return executeGetWeather({
      location: locRaw.trim() || undefined,
      latitude: Number.isFinite(lat) ? lat : undefined,
      longitude: Number.isFinite(lon) ? lon : undefined,
      days: Number.isFinite(days) ? days : undefined,
    });
  }
  return {
    ok: false,
    forModel: `Unknown web tool: ${name}`,
    error: 'Неизвестный tool',
  };
}
