/** OpenAI-style tools for coding sandbox (React / static site files). */

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

export const CODING_SYSTEM_EXTRA = `РЕЖИМ КОДИНГА (песочница проекта в этом чате):
У тебя ОБЯЗАТЕЛЬНО есть tools: list_files, read_file, write_file, delete_file.
Файлы уже могут содержать стартовый React (Vite) шаблон — не описывай код «словами» вместо tools.

ПРАВИЛА:
1) Любое создание/правка/чтение кода — ТОЛЬКО через tools. Не притворяйся, что файл записан, если write_file не вызывался.
2) Перед правкой существующего файла: read_file (можно start_line/end_line). Для больших файлов читай частями.
3) После правок кратко опиши результат пользователю. Не вставляй огромные блоки кода в чат — код живёт в файлах.
4) Предпочитай React (src/App.jsx, src/styles.css, src/main.jsx). Превью в UI умеет React через CDN.
5) Пиши компактно, без лишних зависимостей. Не используй сеть/сервер пользователя.
6) Если нужно много файлов — несколько write_file подряд, затем короткий итог.`;

export type ToolCallFn = {
  id: string;
  type?: string;
  function: { name: string; arguments: string };
};
