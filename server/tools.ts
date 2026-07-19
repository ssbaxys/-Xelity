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
  {
    type: 'function' as const,
    function: {
      name: 'check_build',
      description:
        'Compile/check the site preview the same way the UI does (React/Babel entry src/App.jsx). Returns ok or structured syntax/build errors with file and line. Call after meaningful edits before telling the user the site is ready.',
      parameters: {
        type: 'object',
        properties: {},
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
        'Get live weather and multi-day forecast via Open-Meteo. ALWAYS pass the place the user asked for in location (exact settlement). Do NOT reuse coordinates from a previous place. Do not invent numbers.',
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description:
              'Settlement name as the user meant it, e.g. «Усть-Кокса», «Горно-Алтайск», «Москва». Prefer «Name, Region» for small towns.',
          },
          latitude: {
            type: 'number',
            description: 'Only if user gave exact coordinates; never copy from an earlier weather call',
          },
          longitude: {
            type: 'number',
            description: 'Only if user gave exact coordinates; never copy from an earlier weather call',
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
Вызывай их ТОЛЬКО через API tool_calls (function calling). ЗАПРЕЩЕНО писать в ответ текст вроде <|tool_call|>, call:get_weather{…}, XML tool_call — пользователь это увидит как мусор.

ПОГОДА:
- Если пользователь спрашивает про погоду / температуру / дождь / прогноз — ОБЯЗАТЕЛЬНО вызови get_weather. ЗАПРЕЩЕНО web_search для погоды.
- В location передай ИМЕННО тот населённый пункт (напр. «Усть-Кокса, Республика Алтай»). Не подменяй на областной центр.
- Не передавай latitude/longitude от прошлого запроса — только свежий location (или city/place).
- Если tool пишет «не найдено» / опечатка — НЕ выдумывай, что «города нет в метео-базах мира». Повтори get_weather с исправленным названием из подсказки tool (напр. Баранул → Барнаул).
- UI сам покажет карточку погоды. В ответе укажи: сейчас X°C и сегодня min…max (днём часто сравнивают с Google по максимуму дня, не по «сейчас»).
- Asia/Barnaul в TZ — пояс Алтая, это не город Барнаул.

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

export const CODING_SYSTEM_EXTRA = `РЕЖИМ КОДИНГА (сайт в этом чате):
Инструменты: list_files, read_file, write_file, delete_file, check_build.
Стартовый шаблон React/Vite уже может быть — не пересоздавай без нужды.

СТРОГО ПРО ДЕЙСТВИЯ (важнее вежливых слов):
- Сначала правь файлы инструментами, потом отвечай пользователю. Ответ без реальных правок = провал.
- ЗАПРЕЩЕНО писать извинения вроде «произошла техническая ошибка… я исправил структуру… теперь всё работает», если ты НЕ вызвал write_file/delete_file и НЕ получил check_build ok.
- Если превью сломано — прочитай проблемные файлы, исправь записью в файлы, вызови check_build. Пока check_build не ok — не утверждай, что всё готово.
- Короткий итог заказчику — только после успешной проверки.

ФАЙЛЫ И СТИЛИ (частая ошибка превью):
- CSS ТОЛЬКО в .css (обычно src/styles.css). НИКОГДА не вставляй блоки :root {…}, body {…}, селекторы и «сырой» CSS внутрь .jsx/.js.
- В JSX — только className и при необходимости style={{…}} объектом. Подключение стилей: import './styles.css' в src/main.jsx (или App.jsx) — это нормально; содержимое CSS живёт в styles.css.
- Не дублируй весь CSS внутри App.jsx строкой или как код без тегов.
- Точка входа UI: default export function App в src/App.jsx.

КАК ГОВОРИТЬ С ПОЛЬЗОВАТЕЛЕМ:
- Он заказчик сайта, не разработчик. Не упоминай tools, write_file, check_build, песочницу, PreviewApp.
- Без огромных блоков кода в чате. По-деловому: что изменилось на сайте.

ПОРЯДОК РАБОТЫ:
1) read_file нужных файлов → 2) write_file полным содержимым → 3) check_build → 4) при ошибках снова правки → 5) краткий ответ.
Компактно, без лишних зависимостей.`;

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
