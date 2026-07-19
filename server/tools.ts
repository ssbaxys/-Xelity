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
        'Search the public web. Returns titles, URLs, snippets; may include IMAGE urls. Set images:true to search image results for embedding in the reply. After text search, decide which URLs to open with web_fetch.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query in the user language or English',
          },
          images: {
            type: 'boolean',
            description:
              'If true — search images (for [[img: Title | IMAGE | PAGE]] blocks in the answer). Default false.',
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
  {
    type: 'function' as const,
    function: {
      name: 'get_weather',
      description:
        'Get live weather and multi-day forecast via Open-Meteo (global, accurate). Use whenever the user asks about weather, temperature, rain, wind, or forecast for a place. Returns structured data for the UI weather card — do not invent numbers.',
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'City or place name, e.g. Москва, London, Tokyo',
          },
          latitude: {
            type: 'number',
            description: 'Optional latitude if known',
          },
          longitude: {
            type: 'number',
            description: 'Optional longitude if known',
          },
          days: {
            type: 'integer',
            description: 'Forecast days 1–7 (default 7)',
            minimum: 1,
            maximum: 7,
          },
        },
        additionalProperties: false,
      },
    },
  },
];

export const WEB_SYSTEM_EXTRA = `АГЕНТСКИЕ WEB-TOOLS (реальный доступ):
У тебя есть tools: web_search, web_fetch и get_weather (Open-Meteo).

ПОГОДА:
- Если пользователь спрашивает про погоду / температуру / дождь / прогноз — ОБЯЗАТЕЛЬНО вызови get_weather (не угадывай и не бери погоду из web_search).
- Укажи location (город). UI покажет интерактивную карточку; в тексте дай краткий итог.
- Источник данных: Open-Meteo.

ЭКОНОМИЯ ТОКЕНОВ (поиск):
1) web_search даёт список: номер, title, URL, snippet; иногда строку IMAGE: (прямая картинка).
2) После поиска САМА выбери, что читать:
   - если сниппетов достаточно — НЕ вызывай web_fetch;
   - обычно 1–3 URL; «все» — только если нужно; urls до 5 за один web_fetch.
3) НЕ выдумывай содержимое сайтов и НЕ утверждай, что «проверил интернет», если tool не вызывался.

КАРТИНКИ В ОТВЕТЕ ПОЛЬЗОВАТЕЛЮ:
- Нужны фото/иллюстрации → web_search с images:true (или обычный поиск, если есть IMAGE:).
- Вставь в ответ блок (строго такой формат, до 4 шт.):
  [[img: Заголовок | URL_картинки | URL_страницы_источника]]
- UI покажет картинку, заголовок и ссылку на КОРЕНЬ источника (https://домен/).
- Только реальные URL из результатов tools — не выдумывай картинки.

КОГДА ВЫЗЫВАТЬ:
- Свежие факты / новости / доки / цены → web_search → выборочный web_fetch.
- Картинки к ответу → web_search (images:true) + блоки [[img: …]].
- Ссылка от пользователя → web_fetch.
- Погода → get_weather.

ЗАПРЕЩЕНО: localhost, внутренние IP, не-http(s). При ошибке — скажи честно.`;

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
