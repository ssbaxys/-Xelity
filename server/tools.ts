/** OpenAI-style tools for coding sandbox (static site files). */

export const CODING_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'list_files',
      description: 'List all files in the current chat site sandbox.',
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
      description: 'Read a file from the site sandbox by path (e.g. index.html, styles.css).',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Relative file path inside the sandbox',
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
        'Create or overwrite a file in the sandbox. Prefer compact static HTML/CSS/vanilla JS.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Relative file path (e.g. index.html, app.js)',
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

export const CODING_SYSTEM_EXTRA = `РЕЖИМ КОДИНГА (песочница сайта в этом чате):
У тебя есть tools: list_files, read_file, write_file, delete_file.
- Файлы живут только в песочнице чата. Нет доступа к диску сервера и интернету пользователя.
- Для сайтов предпочитай статический HTML + CSS + vanilla JS (один index.html или мало файлов). Без тяжёлых фреймворков и без лишних CDN, если можно проще.
- Пиши оптимизированно: мало зависимостей, короткие ассеты, без фоновых polling/тяжёлых анимаций.
- Сначала list/read при необходимости, затем write_file. После правок кратко опиши пользователю, что сделал и как открыть превью/скачать ZIP.
- Не выдумывай успех tool без вызова. Если tool недоступен — скажи честно.
- React/Vite-каркас можно отдать как файлы для скачивания, но live-превью рассчитано на статику.`;

export type ToolCallFn = {
  id: string;
  type?: string;
  function: { name: string; arguments: string };
};
