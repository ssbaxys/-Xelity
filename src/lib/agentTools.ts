import { auth } from './firebase';
import { classifyHttpError, wrapFetchError } from './chatApiError';
import type { ToolActivity, ToolActivityLink } from './chatStore';

export type RemoteToolResult = {
  ok: boolean;
  content: string;
  summary?: string;
  error?: string;
  title?: string;
  url?: string;
  query?: string;
  links?: ToolActivityLink[];
};

export async function executeRemoteTool(
  name: string,
  argsJson: string,
): Promise<RemoteToolResult> {
  const apiBase =
    (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') || '';

  let idToken: string | undefined;
  try {
    idToken = (await auth.currentUser?.getIdToken()) || undefined;
  } catch {
    idToken = undefined;
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (idToken) headers.Authorization = `Bearer ${idToken}`;

  let res: Response;
  try {
    res = await fetch(`${apiBase}/api/tools`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name, arguments: argsJson }),
    });
  } catch (err) {
    throw wrapFetchError(err);
  }

  const data = (await res.json().catch(() => ({}))) as RemoteToolResult & { error?: string };
  if (!res.ok) {
    throw classifyHttpError(res.status, data.error || 'Ошибка tool');
  }

  return {
    ok: Boolean(data.ok),
    content: String(data.content || ''),
    summary: data.summary,
    error: data.error,
    title: data.title,
    url: data.url,
    query: data.query,
    links: Array.isArray(data.links) ? data.links : undefined,
  };
}

/** Парсит текст выдачи web_search в список ссылок */
export function parseSearchLinks(forModel: string): ToolActivityLink[] {
  const links: ToolActivityLink[] = [];
  const blocks = forModel.split(/\n(?=(?:\d+\.\s|\[\d+\]\s))/);
  for (const block of blocks) {
    const titleM = block.match(/^(?:\[\d+\]|\d+\.)\s+(.+)/);
    const urlM = block.match(/URL:\s*(\S+)/i);
    if (!titleM || !urlM) continue;
    const snippetLine = block
      .split('\n')
      .map((l) => l.trim())
      .find(
        (l) =>
          l &&
          !/^(?:\[\d+\]|\d+\.)/.test(l) &&
          !/^URL:/i.test(l) &&
          l !== '(no snippet)' &&
          !/^Source:/i.test(l),
      );
    const snippet = snippetLine?.replace(/^Snippet:\s*/i, '').slice(0, 400);
    links.push({
      title: titleM[1].trim().slice(0, 200),
      url: urlM[1].trim().slice(0, 500),
      snippet: snippet || undefined,
    });
  }
  return links.slice(0, 12);
}

export function activityFromWebTool(
  id: string,
  name: string,
  argsJson: string,
  result: RemoteToolResult,
): ToolActivity {
  let query: string | undefined;
  let url: string | undefined;
  let urls: string[] | undefined;
  try {
    const args = JSON.parse(argsJson || '{}') as {
      query?: string;
      url?: string;
      urls?: string[];
    };
    query = args.query ? String(args.query) : undefined;
    url = args.url ? String(args.url) : undefined;
    if (Array.isArray(args.urls)) {
      urls = args.urls.map(String).filter(Boolean).slice(0, 5);
    }
  } catch {
    /* ignore */
  }

  if (name === 'web_search') {
    const links =
      result.links?.length && result.ok
        ? result.links
        : result.ok
          ? parseSearchLinks(result.content)
          : [];
    return {
      id,
      name,
      kind: 'search',
      ok: result.ok,
      error: result.error,
      path: result.query || query,
      after: result.content.slice(0, 12_000),
      links: links.length ? links : undefined,
      pending: false,
    };
  }

  const fetchPath =
    urls && urls.length > 1
      ? `${urls.length} стр.`
      : result.url || url || urls?.[0];

  return {
    id,
    name,
    kind: 'fetch',
    ok: result.ok,
    error: result.error,
    path: fetchPath,
    after: result.content.slice(0, 12_000),
    links: result.links?.length ? result.links : undefined,
    pending: false,
  };
}

export const WEB_TOOL_NAMES = new Set(['web_search', 'web_fetch']);
