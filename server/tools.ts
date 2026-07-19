/** OpenAI-style tools: coding sandbox + web agent (SearXNG / fetch). */

export const CODING_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'list_files',
      description: 'List all files in the current chat project sandbox.',
      parameters: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'read_file',
      description:
        'Read a file from the sandbox. Optionally read only a line range (1-based inclusive). Prefer ranges for large files.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Relative path, e.g. src/App.jsx',
          },
          start_line: {
            type: 'integer',
            description: 'First line to read (1-based). Optional.',
          },
          end_line: {
            type: 'integer',
            description: 'Last line to read (1-based). Optional.',
          },
        },
        required: ['path'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'write_file',
      description:
        'Create or overwrite a full file in the sandbox. Always pass the complete file contents.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Relative path (e.g. src/App.jsx, src/styles.css)',
          },
          content: {
            type: 'string',
            description: 'Full file contents',
          },
        },
        required: ['path', 'content'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'delete_file',
      description: 'Delete a file from the sandbox.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Relative file path to delete',
          },
        },
        required: ['path'],
        additionalProperties: false,
      },
    },
  },
];

export const WEB_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'web_search',
      description:
        'Search the public web. Returns a numbered list of titles, URLs and short snippets ONLY — not full page bodies. After search, decide which URLs (if any) to open with web_fetch.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query in the user language or English',
          },
        },
        required: ['query'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'web_fetch',
      description:
        'Read full readable text from one or more public http(s) URLs chosen from web_search (or given by the user). Prefer few relevant pages to save tokens. Pass url for one page, or urls for several (max 5). Do not invent page contents.',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'Single public URL to read',
          },
          urls: {
            type: 'array',
            description: 'Several public URLs to read in one call (max 5). Prefer this over many separate fetches.',
            items: { type: 'string' },
            maxItems: 5,
          },
        },
        additionalProperties: false,
      },
    },
  },
];

export const WEB_SYSTEM_EXTRA = `АГЕНТСКИЕ WEB-TOOLS (реальный доступ):
У тебя есть tools: web_search (список результатов) и web_fetch (чтение содержимого выбранных сайтов).

ЭКОНОМИЯ ТОКЕНОВ (важно):
1) web_search даёт ТОЛЬКО список: номер, title, URL, короткий snippet — НЕ полный текст страниц.
2) После поиска САМА выбери, что читать:
   - если сниппетов достаточно для ответа — НЕ вызывай web_fetch;
   - обычно открой 1–3 самых релевантных URL;
   - «прочитать все» — только если задача явно требует сверки многих источников;
   - не больше 5 URL за один web_fetch (параметр urls).
3) Один вызов web_fetch с urls=[...] лучше, чем много отдельных вызовов (меньше раундов API).
4) НЕ выдумывай содержимое сайтов и НЕ утверждай, что «проверил интернет», если tool не вызывался.

КОГДА ВЫЗЫВАТЬ:
- Свежие факты / новости / доки / цены → web_search → выборочный web_fetch.
- Пользователь дал ссылку → сразу web_fetch по этой ссылке.
- Спорные факты → укажи URL источника в ответе.

ЗАПРЕЩЕНО: localhost, внутренние IP, не-http(s). При ошибке поиска/загрузки — скажи честно.`;

export const CODING_SYSTEM_EXTRA = `РЕЖИМ КОДИНГА (песочница проекта в этом чате):
У тебя ОБЯЗАТЕЛЬНО есть tools: list_files, read_file, write_file, delete_file.
Файлы уже могут содержать стартовый React (Vite) шаблон — не описывай код «словами» вместо tools.

ПРАВИЛА:
1) Любое создание/правка/чтение кода — ТОЛЬКО через tools. Не притворяйся, что файл записан, если write_file не вызывался.
2) Перед правкой существующего файла: read_file (можно start_line/end_line). Для больших файлов читай частями.
3) После правок кратко опиши результат пользователю. Не вставляй огромные блоки кода в чат — код живёт в файлах.
4) Предпочитай React (src/App.jsx, src/styles.css, src/main.jsx). Превью в UI умеет React через CDN.
5) Пиши компактно, без лишних зависимостей. Сеть для кода сайта — через web_search/web_fetch при необходимости документации; файлы песочницы — только coding tools.
6) Если нужно много файлов — несколько write_file подряд, затем короткий итог.`;

export const CODING_TOOL_NAMES = new Set(
  CODING_TOOLS.map((t) => t.function.name),
);
export const WEB_TOOL_NAMES = new Set(WEB_TOOLS.map((t) => t.function.name));

export function buildToolList(opts: { codingTools?: boolean; webTools?: boolean }) {
  const list = [];
  if (opts.webTools !== false) list.push(...WEB_TOOLS);
  if (opts.codingTools) list.push(...CODING_TOOLS);
  return list;
}

export type ToolCallFn = {
  id: string;
  type?: string;
  function: { name: string; arguments: string };
};
