/**
 * Текстовые tool-call маркеры от моделей (Gemma и др.):
 *   <|tool_call>call:get_weather{location: "Барнаул"}<tool_call|>
 */

export type ParsedToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};

/** Достаёт {...} с учётом строк и вложенных скобок (важно для write_file с JSX). */
export function extractBalancedObject(
  s: string,
  from = 0,
): { raw: string; start: number; end: number } | null {
  const i = s.indexOf('{', from);
  if (i < 0) return null;
  let depth = 0;
  let quote: '"' | "'" | '`' | null = null;
  let esc = false;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (quote) {
      if (esc) {
        esc = false;
        continue;
      }
      if (c === '\\') {
        esc = true;
        continue;
      }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      quote = c;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return { raw: s.slice(i, j + 1), start: i, end: j + 1 };
    }
  }
  return null;
}

/**
 * JS-подобный объект → JSON.
 * Не ломает содержимое строк (в отличие от глобальной замены ' → ").
 */
export function jsObjectToJson(raw: string): string {
  let s = raw.trim();
  if (!s) return '{}';
  if (!s.startsWith('{')) s = `{${s}}`;

  try {
    JSON.parse(s);
    return s;
  } catch {
    /* convert below */
  }

  let out = '';
  let i = 0;
  let quote: '"' | "'" | '`' | null = null;
  let esc = false;

  const isIdentStart = (c: string) => /[A-Za-z_]/.test(c);
  const isIdent = (c: string) => /[A-Za-z0-9_]/.test(c);

  while (i < s.length) {
    const c = s[i];

    if (quote) {
      if (esc) {
        out += c;
        esc = false;
        i++;
        continue;
      }
      if (c === '\\') {
        out += c;
        esc = true;
        i++;
        continue;
      }
      if (c === quote) {
        out += '"';
        quote = null;
        i++;
        continue;
      }
      if (quote === "'" && c === '"') {
        out += '\\"';
        i++;
        continue;
      }
      if (quote !== '"' && c === '\n') {
        out += '\\n';
        i++;
        continue;
      }
      if (quote !== '"' && c === '\r') {
        i++;
        continue;
      }
      out += c;
      i++;
      continue;
    }

    if (c === '"' || c === "'" || c === '`') {
      quote = c;
      out += '"';
      i++;
      continue;
    }

    // bare key → "key"
    if (isIdentStart(c)) {
      let j = i + 1;
      while (j < s.length && isIdent(s[j])) j++;
      const ident = s.slice(i, j);
      let k = j;
      while (k < s.length && /\s/.test(s[k])) k++;
      if (s[k] === ':') {
        out += `"${ident}"`;
        i = j;
        continue;
      }
      out += ident;
      i = j;
      continue;
    }

    // trailing commas
    if (c === ',') {
      let k = i + 1;
      while (k < s.length && /\s/.test(s[k])) k++;
      if (s[k] === '}' || s[k] === ']') {
        i++;
        continue;
      }
    }

    out += c;
    i++;
  }

  try {
    JSON.parse(out);
    return out;
  } catch {
    const recovered = recoverArgsObject(s);
    return recovered || '{}';
  }
}

/** Запасной разбор path/content, если JSON всё ещё битый. */
function recoverArgsObject(raw: string): string | null {
  const path =
    matchQuotedField(raw, 'path') ||
    matchQuotedField(raw, 'file_path') ||
    matchQuotedField(raw, 'filepath') ||
    matchQuotedField(raw, 'file') ||
    matchQuotedField(raw, 'filename');
  const content = matchQuotedField(raw, 'content');
  const query = matchQuotedField(raw, 'query');
  const location = matchQuotedField(raw, 'location');
  const url = matchQuotedField(raw, 'url');

  const obj: Record<string, string> = {};
  if (path) obj.path = path;
  if (content != null) obj.content = content;
  if (query) obj.query = query;
  if (location) obj.location = location;
  if (url) obj.url = url;
  if (!Object.keys(obj).length) return null;
  return JSON.stringify(obj);
}

function matchQuotedField(raw: string, key: string): string | null {
  const re = new RegExp(
    `(?:^|[,{]\\s*)(?:"${key}"|${key})\\s*:\\s*("(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*')`,
    'i',
  );
  const m = raw.match(re);
  if (!m?.[1]) return null;
  const lit = m[1];
  try {
    if (lit.startsWith('"')) return JSON.parse(lit) as string;
    // single-quoted
    return lit
      .slice(1, -1)
      .replace(/\\'/g, "'")
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\\\/g, '\\');
  } catch {
    return lit.slice(1, -1);
  }
}

/** path / file_path / filepath / file / filename */
export function resolveToolPath(args: Record<string, unknown>): string {
  const keys = ['path', 'file_path', 'filepath', 'file', 'filename'] as const;
  for (const k of keys) {
    const v = args[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

export function parseToolArgs(argsJson: string): Record<string, unknown> {
  if (!argsJson || !argsJson.trim()) return {};
  try {
    const v = JSON.parse(argsJson) as unknown;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return v as Record<string, unknown>;
    }
  } catch {
    /* try js-like */
  }
  try {
    return JSON.parse(jsObjectToJson(argsJson)) as Record<string, unknown>;
  } catch {
    return {};
  }
}

const KNOWN_TOOLS = new Set([
  'get_weather',
  'web_search',
  'web_fetch',
  'list_files',
  'read_file',
  'write_file',
  'delete_file',
  'check_build',
]);

function makeId(i: number): string {
  return `text_tc_${Date.now().toString(36)}_${i}`;
}

type Match = { full: string; name: string; argsRaw: string };

const NAME_PATTERNS: RegExp[] = [
  /<\|?tool_call\|?>\s*(?:call:)?([a-zA-Z_][\w]*)\s*/gi,
  /(?:^|\n)\s*call:([a-zA-Z_][\w]*)\s*/gi,
  /<tool_call>\s*(?:call:)?([a-zA-Z_][\w]*)\s*/gi,
  /```(?:tool|tool_call)?\s*\n?\s*(?:call:)?([a-zA-Z_][\w]*)\s*\n\s*/gi,
];

function collectMatches(content: string): Match[] {
  const found: Match[] = [];

  for (const re of NAME_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      const name = m[1] || '';
      if (!KNOWN_TOOLS.has(name)) continue;
      const afterName = m.index + m[0].length;
      const bal = extractBalancedObject(content, afterName);
      if (!bal) continue;

      // хвост маркера после объекта (опционально)
      let end = bal.end;
      const tail = content.slice(end);
      const tailClose = tail.match(
        /^\s*(?:<\|?\/?tool_call\|?>|<\/tool_call>|<tool_call\|>|\n?```)/i,
      );
      if (tailClose) end += tailClose[0].length;

      const full = content.slice(m.index, end);
      if (found.some((f) => f.full === full || (f.name === name && f.argsRaw === bal.raw))) {
        continue;
      }
      found.push({ full, name, argsRaw: bal.raw });
    }
  }
  return found;
}

export function extractTextualToolCalls(content: string): {
  cleaned: string;
  tool_calls: ParsedToolCall[];
} {
  if (!content || !/(tool_call|call:\s*[a-zA-Z_])/i.test(content)) {
    return { cleaned: content, tool_calls: [] };
  }

  const matches = collectMatches(content);
  if (!matches.length) {
    const cleaned = content
      .replace(/<\|?tool_call\|?>/gi, '')
      .replace(/<\/?tool_call\|?>/gi, '')
      .replace(/<tool_call\|?>/gi, '')
      .trim();
    return { cleaned, tool_calls: [] };
  }

  let cleaned = content;
  const tool_calls: ParsedToolCall[] = [];
  matches.forEach((m, i) => {
    cleaned = cleaned.replace(m.full, '');
    tool_calls.push({
      id: makeId(i),
      type: 'function',
      function: {
        name: m.name,
        arguments: jsObjectToJson(m.argsRaw),
      },
    });
  });

  cleaned = cleaned
    .replace(/<\|?tool_call\|?>/gi, '')
    .replace(/<\/?tool_call\|?>/gi, '')
    .replace(/<tool_call\|?>/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { cleaned, tool_calls: tool_calls.slice(0, 8) };
}
