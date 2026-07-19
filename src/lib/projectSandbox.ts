/** Песочница файлов сайта — на чат, в localStorage */

import type { ToolActivity, ToolActivityKind } from './chatStore';

export type SandboxFile = {
  path: string;
  content: string;
  updatedAt: number;
};

export type ChatSandbox = {
  chatId: string;
  files: Record<string, SandboxFile>;
  updatedAt: number;
};

const KEY = 'xelity-sandbox-v1';
const MAX_FILES = 60;
const MAX_FILE_BYTES = 180_000;
const MAX_TOTAL_BYTES = 1_200_000;

type RootStore = Record<string, ChatSandbox>;

function readRoot(): RootStore {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    return JSON.parse(raw) as RootStore;
  } catch {
    return {};
  }
}

function writeRoot(root: RootStore) {
  localStorage.setItem(KEY, JSON.stringify(root));
  window.dispatchEvent(new CustomEvent('xelity:sandbox-updated'));
}

export function normalizePath(path: string): string {
  return path
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\.\./g, '')
    .trim()
    .slice(0, 180);
}

export function getSandbox(chatId: string): ChatSandbox {
  const root = readRoot();
  return root[chatId] || { chatId, files: {}, updatedAt: Date.now() };
}

export function listSandboxFiles(chatId: string): string[] {
  return Object.keys(getSandbox(chatId).files).sort();
}

export function readSandboxFile(chatId: string, path: string): string | null {
  const p = normalizePath(path);
  const f = getSandbox(chatId).files[p];
  return f ? f.content : null;
}

export function writeSandboxFile(
  chatId: string,
  path: string,
  content: string,
): { ok: true } | { ok: false; error: string } {
  const p = normalizePath(path);
  if (!p) return { ok: false, error: 'Пустой путь' };
  if (content.length > MAX_FILE_BYTES) {
    return { ok: false, error: `Файл слишком большой (макс ${MAX_FILE_BYTES} байт)` };
  }

  const root = readRoot();
  const box = root[chatId] || { chatId, files: {}, updatedAt: Date.now() };
  const nextFiles = { ...box.files, [p]: { path: p, content, updatedAt: Date.now() } };
  if (Object.keys(nextFiles).length > MAX_FILES) {
    return { ok: false, error: `Слишком много файлов (макс ${MAX_FILES})` };
  }
  const total = Object.values(nextFiles).reduce((s, f) => s + f.content.length, 0);
  if (total > MAX_TOTAL_BYTES) {
    return { ok: false, error: 'Песочница переполнена' };
  }

  root[chatId] = { chatId, files: nextFiles, updatedAt: Date.now() };
  writeRoot(root);
  return { ok: true };
}

export function deleteSandboxFile(
  chatId: string,
  path: string,
): { ok: true } | { ok: false; error: string } {
  const p = normalizePath(path);
  const root = readRoot();
  const box = root[chatId];
  if (!box?.files[p]) return { ok: false, error: 'Файл не найден' };
  const next = { ...box.files };
  delete next[p];
  root[chatId] = { chatId, files: next, updatedAt: Date.now() };
  writeRoot(root);
  return { ok: true };
}

export function clearSandbox(chatId: string) {
  const root = readRoot();
  delete root[chatId];
  writeRoot(root);
}

/** Дерево путей → вложенные папки/файлы */
export type FileTreeNode = {
  name: string;
  path: string;
  kind: 'file' | 'dir';
  children?: FileTreeNode[];
};

export function buildFileTree(paths: string[]): FileTreeNode[] {
  type Dir = { name: string; path: string; dirs: Map<string, Dir>; files: FileTreeNode[] };
  const root: Dir = { name: '', path: '', dirs: new Map(), files: [] };

  for (const raw of paths) {
    const parts = raw.split('/').filter(Boolean);
    let cur = root;
    let acc = '';
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      acc = acc ? `${acc}/${part}` : part;
      const isFile = i === parts.length - 1;
      if (isFile) {
        cur.files.push({ name: part, path: acc, kind: 'file' });
      } else {
        let next = cur.dirs.get(part);
        if (!next) {
          next = { name: part, path: acc, dirs: new Map(), files: [] };
          cur.dirs.set(part, next);
        }
        cur = next;
      }
    }
  }

  const toNodes = (d: Dir): FileTreeNode[] => {
    const dirs = [...d.dirs.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((x) => ({
        name: x.name,
        path: x.path,
        kind: 'dir' as const,
        children: toNodes(x),
      }));
    const files = d.files.sort((a, b) => a.name.localeCompare(b.name));
    return [...dirs, ...files];
  };

  return toNodes(root);
}

const REACT_TEMPLATE: Record<string, string> = {
  'package.json': `{
  "name": "xelity-site",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "vite": "^5.4.11"
  }
}
`,
  'vite.config.js': `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
`,
  'index.html': `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Xelity Site</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`,
  'src/main.jsx': `import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
`,
  'src/App.jsx': `export default function App() {
  return (
    <div className="page">
      <header className="header">
        <div className="brand">NovaSite</div>
        <nav className="nav">
          <a href="#features">Возможности</a>
          <a href="#about">О нас</a>
          <a href="#cta">Старт</a>
        </nav>
      </header>

      <main>
        <section className="hero">
          <p className="eyebrow">Одностраничный сайт</p>
          <h1>Чистый React-шаблон для быстрого старта</h1>
          <p className="lead">
            Адаптивная вёрстка, понятная структура и готовые блоки — правьте файлы в панели справа.
          </p>
          <div className="actions">
            <a className="btn primary" href="#cta">
              Начать
            </a>
            <a className="btn ghost" href="#features">
              Смотреть блоки
            </a>
          </div>
        </section>

        <section id="features" className="section">
          <h2>Возможности</h2>
          <div className="grid">
            <article className="card">
              <h3>Быстрый старт</h3>
              <p>Vite + React: привычный стек, удобно развивать локально.</p>
            </article>
            <article className="card">
              <h3>Адаптив</h3>
              <p>Базовые стили уже учитывают узкие экраны.</p>
            </article>
            <article className="card">
              <h3>Превью в чате</h3>
              <p>Смотрите результат во вкладке «Превью» без сборки на сервере.</p>
            </article>
          </div>
        </section>

        <section id="about" className="section muted">
          <h2>О шаблоне</h2>
          <p>
            Это стартовая точка. Попросите ИИ добавить форму, галерею, тарифы или анимации — правки
            появятся в файлах проекта.
          </p>
        </section>

        <section id="cta" className="cta">
          <h2>Готовы продолжить?</h2>
          <p>Напишите в чат, что нужно изменить.</p>
          <button
            type="button"
            className="btn primary"
            onClick={() => alert('Привет! Шаблон работает.')}
          >
            Проверить JS
          </button>
        </section>
      </main>

      <footer className="footer">© NovaSite · Xelity sandbox</footer>
    </div>
  );
}
`,
  'src/styles.css': `:root {
  --bg: #0f1115;
  --panel: #171a21;
  --text: #eef1f6;
  --muted: #9aa3b2;
  --line: #2a3140;
  --accent: #c62828;
  --accent-soft: rgba(198, 40, 40, 0.16);
  font-family: "Segoe UI", system-ui, sans-serif;
  color: var(--text);
  background: var(--bg);
}

* { box-sizing: border-box; }
body { margin: 0; }
a { color: inherit; text-decoration: none; }

.page { min-height: 100vh; }
.header {
  display: flex; align-items: center; justify-content: space-between;
  gap: 1rem; padding: 1rem 1.25rem; border-bottom: 1px solid var(--line);
  position: sticky; top: 0; background: rgba(15, 17, 21, 0.88); backdrop-filter: blur(10px);
}
.brand { font-weight: 700; letter-spacing: 0.04em; }
.nav { display: flex; gap: 1rem; flex-wrap: wrap; color: var(--muted); font-size: 0.92rem; }
.nav a:hover { color: var(--text); }

.hero { padding: 4.5rem 1.25rem 3rem; max-width: 720px; }
.eyebrow { color: var(--accent); text-transform: uppercase; letter-spacing: 0.12em; font-size: 0.75rem; }
.hero h1 { font-size: clamp(1.8rem, 4vw, 2.8rem); line-height: 1.15; margin: 0.4rem 0 0.8rem; }
.lead { color: var(--muted); font-size: 1.05rem; line-height: 1.6; }
.actions { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 1.4rem; }

.btn {
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 0.7rem; padding: 0.7rem 1.1rem; border: 1px solid transparent;
  font-weight: 600; cursor: pointer;
}
.btn.primary { background: var(--accent); color: #fff; }
.btn.ghost { border-color: var(--line); background: transparent; color: var(--text); }
.btn:hover { filter: brightness(1.08); }

.section { padding: 2.5rem 1.25rem; max-width: 960px; }
.section.muted { color: var(--muted); }
.section h2 { margin: 0 0 1rem; }
.grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
.card {
  background: var(--panel); border: 1px solid var(--line); border-radius: 1rem; padding: 1.1rem;
}
.card h3 { margin: 0 0 0.45rem; font-size: 1rem; }
.card p { margin: 0; color: var(--muted); line-height: 1.5; font-size: 0.92rem; }

.cta {
  margin: 1rem 1.25rem 3rem; padding: 2rem; border-radius: 1.2rem;
  background: linear-gradient(160deg, var(--accent-soft), transparent), var(--panel);
  border: 1px solid var(--line); max-width: 960px;
}
.footer { padding: 1.5rem 1.25rem 2.5rem; color: var(--muted); font-size: 0.85rem; border-top: 1px solid var(--line); }

@media (max-width: 640px) {
  .header { flex-direction: column; align-items: flex-start; }
  .hero { padding-top: 2.5rem; }
}
`,
};

/** Создаёт React-шаблон, если песочница пуста. Возвращает карточки «создание». */
export function ensureReactSiteTemplate(chatId: string): ToolActivity[] {
  if (listSandboxFiles(chatId).length) return [];
  const activities: ToolActivity[] = [];
  let i = 0;
  for (const [path, content] of Object.entries(REACT_TEMPLATE)) {
    const res = writeSandboxFile(chatId, path, content);
    activities.push({
      id: `seed-${i++}-${path}`,
      name: 'write_file',
      kind: 'create',
      path,
      ok: res.ok,
      error: res.ok ? undefined : res.error,
      before: '',
      after: content,
    });
  }
  return activities;
}

function sliceLines(content: string, startLine?: number, endLine?: number) {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const start = Math.max(1, startLine || 1);
  const end = Math.min(lines.length, endLine || lines.length);
  if (start > lines.length) {
    return { text: '', startLine: start, endLine: start - 1, total: lines.length };
  }
  const slice = lines.slice(start - 1, end);
  return {
    text: slice.map((l, idx) => `${String(start + idx).padStart(4, ' ')}| ${l}`).join('\n'),
    raw: slice.join('\n'),
    startLine: start,
    endLine: Math.min(end, lines.length),
    total: lines.length,
  };
}

export type SandboxToolRun = {
  forModel: string;
  activity: ToolActivity;
};

export function runSandboxTool(
  chatId: string,
  name: string,
  argsJson: string,
  callId?: string,
): SandboxToolRun {
  const id = callId || `tool-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  let args: Record<string, unknown> = {};
  try {
    args = argsJson ? (JSON.parse(argsJson) as Record<string, unknown>) : {};
  } catch {
    return {
      forModel: JSON.stringify({ error: 'Невалидный JSON arguments' }),
      activity: { id, name, kind: 'edit', ok: false, error: 'Невалидный JSON arguments' },
    };
  }

  if (name === 'list_files') {
    const files = listSandboxFiles(chatId);
    return {
      forModel: JSON.stringify({ files }),
      activity: { id, name, kind: 'list', ok: true, after: files.join('\n') },
    };
  }

  if (name === 'read_file') {
    const path = normalizePath(String(args.path || ''));
    const content = readSandboxFile(chatId, path);
    if (content == null) {
      return {
        forModel: JSON.stringify({ error: 'Файл не найден', path }),
        activity: { id, name, kind: 'read', path, ok: false, error: 'Файл не найден' },
      };
    }
    const startLine = args.start_line != null ? Number(args.start_line) : undefined;
    const endLine = args.end_line != null ? Number(args.end_line) : undefined;
    const sliced = sliceLines(content, startLine, endLine);
    return {
      forModel: JSON.stringify({
        path,
        start_line: sliced.startLine,
        end_line: sliced.endLine,
        total_lines: sliced.total,
        content: sliced.text,
      }),
      activity: {
        id,
        name,
        kind: 'read',
        path,
        ok: true,
        startLine: sliced.startLine,
        endLine: sliced.endLine,
        after: sliced.raw ?? sliced.text,
      },
    };
  }

  if (name === 'write_file') {
    const path = normalizePath(String(args.path || ''));
    const content = String(args.content ?? '');
    const before = readSandboxFile(chatId, path);
    const kind: ToolActivityKind = before == null ? 'create' : 'edit';
    const res = writeSandboxFile(chatId, path, content);
    return {
      forModel: JSON.stringify(res.ok ? { ok: true, path, created: kind === 'create' } : res),
      activity: {
        id,
        name,
        kind,
        path,
        ok: res.ok,
        error: res.ok ? undefined : res.error,
        before: before ?? '',
        after: content,
      },
    };
  }

  if (name === 'delete_file') {
    const path = normalizePath(String(args.path || ''));
    const before = readSandboxFile(chatId, path);
    const res = deleteSandboxFile(chatId, path);
    return {
      forModel: JSON.stringify(res.ok ? { ok: true, path } : res),
      activity: {
        id,
        name,
        kind: 'delete',
        path,
        ok: res.ok,
        error: res.ok ? undefined : res.error,
        before: before ?? '',
        after: '',
      },
    };
  }

  return {
    forModel: JSON.stringify({ error: `Неизвестный tool: ${name}` }),
    activity: { id, name, kind: 'edit', ok: false, error: `Неизвестный tool: ${name}` },
  };
}

/** @deprecated use runSandboxTool */
export function executeSandboxTool(chatId: string, name: string, argsJson: string): string {
  return runSandboxTool(chatId, name, argsJson).forModel;
}

function escapeScript(src: string) {
  return src.replace(/<\/script/gi, '<\\/script');
}

/** Превью: React (CDN+Babel) или статический HTML */
export function buildPreviewHtml(chatId: string): string | null {
  const box = getSandbox(chatId);
  const app =
    box.files['src/App.jsx']?.content ||
    box.files['src/App.tsx']?.content ||
    box.files['src/App.js']?.content;
  const css =
    box.files['src/styles.css']?.content ||
    box.files['src/index.css']?.content ||
    box.files['styles.css']?.content ||
    '';

  if (app) {
    // убираем import/export для Babel UMD
    let body = app
      .replace(/^import\s+.+?;?\s*$/gm, '')
      .replace(/export\s+default\s+function\s+App/, 'function App')
      .replace(/export\s+default\s+/, 'const App = ');
    if (!/function App|const App\s*=/.test(body)) {
      body = `function App() {\n  return (<div>${escapeScript(app.slice(0, 2000))}</div>);\n}`;
    }
    return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Preview</title>
<style>${escapeScript(css)}</style>
<script crossorigin src="https://unpkg.com/react@18.3.1/umd/react.development.js"><\/script>
<script crossorigin src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js"><\/script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>
</head>
<body>
<div id="root"></div>
<script type="text/babel" data-presets="react">
${escapeScript(body)}
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(App));
<\/script>
</body>
</html>`;
  }

  const index =
    box.files['index.html']?.content ||
    box.files['Index.html']?.content ||
    Object.values(box.files).find((f) => f.path.endsWith('.html') && f.path !== 'index.html')
      ?.content;
  if (!index) return null;

  let html = index;
  html = html.replace(/<link[^>]+href=["']([^"']+\.css)["'][^>]*>/gi, (full, href: string) => {
    const p = normalizePath(href.replace(/^\//, ''));
    const fileCss = box.files[p]?.content || box.files[`src/${p}`]?.content;
    if (!fileCss) return full;
    return `<style data-src="${p}">\n${fileCss}\n</style>`;
  });
  html = html.replace(
    /<script([^>]*)src=["']([^"']+\.jsx?)["']([^>]*)><\/script>/gi,
    () => '<!-- module preview via React CDN when App.jsx exists -->',
  );
  html = html.replace(
    /<script([^>]*)src=["']([^"']+\.js)["']([^>]*)><\/script>/gi,
    (full, a1: string, src: string, a2: string) => {
      const p = normalizePath(src.replace(/^\//, ''));
      const js = box.files[p]?.content;
      if (!js) return full;
      return `<script${a1}${a2}>\n${js}\n</script>`;
    },
  );
  return html;
}

export async function downloadSandboxZip(chatId: string, filename = 'xelity-site.zip') {
  const JSZip = (await import('jszip')).default;
  const box = getSandbox(chatId);
  const paths = Object.keys(box.files);
  if (!paths.length) throw new Error('Песочница пуста');
  const zip = new JSZip();
  for (const p of paths) {
    zip.file(p, box.files[p].content);
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function subscribeSandbox(cb: () => void): () => void {
  const on = () => cb();
  window.addEventListener('xelity:sandbox-updated', on);
  window.addEventListener('storage', on);
  return () => {
    window.removeEventListener('xelity:sandbox-updated', on);
    window.removeEventListener('storage', on);
  };
}
