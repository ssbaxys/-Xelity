/**
 * Текстовые tool-call маркеры от моделей (Gemma и др.):
 *   <|tool_call>call:get_weather{location: "Барнаул"}<tool_call|>
 */

export type ParsedToolCall = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};

export function jsObjectToJson(raw: string): string {
  let s = raw.trim();
  if (!s.startsWith('{')) s = `{${s}}`;
  s = s.replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":');
  s = s.replace(/'/g, '"');
  s = s.replace(/,\s*([}\]])/g, '$1');
  try {
    JSON.parse(s);
    return s;
  } catch {
    return '{}';
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

function collectMatches(content: string): Match[] {
  const found: Match[] = [];
  const patterns: RegExp[] = [
    /<\|?tool_call\|?>\s*(?:call:)?([a-zA-Z_][\w]*)\s*(\{[\s\S]*?\})\s*<\|?\/?tool_call\|?>/gi,
    /<\|?tool_call\|?>\s*call:([a-zA-Z_][\w]*)\s*(\{[\s\S]*?\})\s*<tool_call\|?>/gi,
    /(?:^|\n)\s*call:([a-zA-Z_][\w]*)\s*(\{[\s\S]*?\})/gi,
    /<tool_call>\s*(?:call:)?([a-zA-Z_][\w]*)\s*(\{[\s\S]*?\})\s*<\/tool_call>/gi,
    /```(?:tool|tool_call)?\s*\n?\s*(?:call:)?([a-zA-Z_][\w]*)\s*\n\s*(\{[\s\S]*?\})\s*\n?```/gi,
  ];

  for (const re of patterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(content)) !== null) {
      const name = m[1] || '';
      const argsRaw = m[2] || '{}';
      if (!KNOWN_TOOLS.has(name)) continue;
      if (found.some((f) => f.full === m![0])) continue;
      found.push({ full: m[0], name, argsRaw });
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
