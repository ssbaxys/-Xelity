/** Песочница файлов сайта — на чат, в localStorage */

import type { ToolActivity, ToolActivityKind } from './chatStore';
import {
  buildReactPreviewDocument,
  buildStaticPreviewDocument,
} from './previewBundle';

export type SandboxFile = {
  path: string;
  content: string;
  updatedAt: number;
};

export type SandboxBuild = {
  id: string;
  index: number;
  label: string;
  createdAt: number;
  files: Record<string, SandboxFile>;
};

export type ChatSandbox = {
  chatId: string;
  files: Record<string, SandboxFile>;
  updatedAt: number;
  builds?: SandboxBuild[];
  buildSeq?: number;
};

const KEY = 'xelity-sandbox-v1';
const MAX_FILES = 60;
const MAX_FILE_BYTES = 180_000;
const MAX_TOTAL_BYTES = 1_200_000;
const MAX_BUILDS = 24;

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

function cloneFiles(files: Record<string, SandboxFile>): Record<string, SandboxFile> {
  const out: Record<string, SandboxFile> = {};
  for (const [k, v] of Object.entries(files)) {
    out[k] = { path: v.path, content: v.content, updatedAt: v.updatedAt };
  }
  return out;
}

/** Снимок рабочей версии (как коммит). Правки всегда идут в files — сборки только для просмотра. */
export function commitSandboxBuild(chatId: string, label?: string): SandboxBuild | null {
  const root = readRoot();
  const box = root[chatId];
  if (!box || !Object.keys(box.files).length) return null;
  const seq = (box.buildSeq || 0) + 1;
  const build: SandboxBuild = {
    id: `b${seq}_${Date.now().toString(36)}`,
    index: seq,
    label: label?.trim() || `Сборка ${seq}`,
    createdAt: Date.now(),
    files: cloneFiles(box.files),
  };
  const builds = [...(box.builds || []), build].slice(-MAX_BUILDS);
  root[chatId] = { ...box, builds, buildSeq: seq, updatedAt: Date.now() };
  writeRoot(root);
  return build;
}

export function listSandboxBuilds(chatId: string): SandboxBuild[] {
  return [...(getSandbox(chatId).builds || [])].sort((a, b) => b.index - a.index);
}

export function getSandboxFilesAt(
  chatId: string,
  buildId: string | 'latest' = 'latest',
): Record<string, SandboxFile> {
  const box = getSandbox(chatId);
  if (buildId === 'latest' || !buildId) return box.files;
  const hit = (box.builds || []).find((b) => b.id === buildId);
  return hit?.files ?? box.files;
}

export function latestBuildId(chatId: string): string | 'latest' {
  const builds = listSandboxBuilds(chatId);
  return builds[0]?.id ?? 'latest';
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
      <div className="template-banner" role="note">
        Это шаблон сайта — замените тексты, блоки и стиль под свой проект
      </div>

      <header className="header">
        <div className="brand">SiteName</div>
        <nav className="nav">
          <a href="#about">О проекте</a>
          <a href="#services">Услуги</a>
          <a href="#contact">Контакты</a>
        </nav>
        <a className="btn small" href="#contact">
          Связаться
        </a>
      </header>

      <main>
        <section className="hero">
          <p className="eyebrow">Шаблон одностраничного сайта</p>
          <h1>Заголовок вашего сайта</h1>
          <p className="lead">
            Это шаблон сайта с типичной структурой: шапка, герой, услуги, о проекте и подвал.
            Опишите в чате, что нужно — превью обновится автоматически.
          </p>
          <div className="actions">
            <a className="btn primary" href="#services">
              Смотреть услуги
            </a>
            <a className="btn ghost" href="#about">
              Узнать больше
            </a>
          </div>
        </section>

        <section id="services" className="section">
          <h2>Услуги</h2>
          <p className="section-lead">Три карточки-заглушки — замените на реальные предложения.</p>
          <div className="grid">
            <article className="card">
              <h3>Услуга 1</h3>
              <p>Краткое описание услуги или преимущества. Это шаблон сайта.</p>
            </article>
            <article className="card">
              <h3>Услуга 2</h3>
              <p>Краткое описание услуги или преимущества. Это шаблон сайта.</p>
            </article>
            <article className="card">
              <h3>Услуга 3</h3>
              <p>Краткое описание услуги или преимущества. Это шаблон сайта.</p>
            </article>
          </div>
        </section>

        <section id="about" className="section muted">
          <h2>О проекте</h2>
          <p>
            Здесь обычно рассказывают о компании или продукте. Сейчас это шаблон сайта — попросите
            изменить тон, добавить фото, форму заявки или тарифы.
          </p>
        </section>

        <section id="contact" className="cta">
          <h2>Контакты</h2>
          <p>Email: hello@example.com · Телефон: +7 (000) 000-00-00</p>
          <button
            type="button"
            className="btn primary"
            onClick={() => alert('Это шаблон сайта — кнопка работает.')}
          >
            Написать нам
          </button>
        </section>
      </main>

      <footer className="footer">
        © SiteName · Это шаблон сайта · Xelity
      </footer>
    </div>
  );
}
`,
  'src/styles.css': `:root {
  --bg: #f6f4f1;
  --panel: #ffffff;
  --text: #1a1c1f;
  --muted: #5c6570;
  --line: #e2ddd6;
  --accent: #c62828;
  --accent-soft: rgba(198, 40, 40, 0.12);
  font-family: "Segoe UI", Georgia, system-ui, sans-serif;
  color: var(--text);
  background: var(--bg);
}

* { box-sizing: border-box; }
body { margin: 0; }
a { color: inherit; text-decoration: none; }

.page { min-height: 100vh; }
.template-banner {
  background: var(--accent);
  color: #fff;
  text-align: center;
  font-size: 0.82rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  padding: 0.55rem 1rem;
}
.header {
  display: flex; align-items: center; justify-content: space-between;
  gap: 1rem; padding: 1rem 1.5rem; border-bottom: 1px solid var(--line);
  position: sticky; top: 0; background: rgba(246, 244, 241, 0.92); backdrop-filter: blur(10px);
  z-index: 2;
}
.brand { font-weight: 800; letter-spacing: -0.02em; font-size: 1.15rem; }
.nav { display: flex; gap: 1.1rem; flex-wrap: wrap; color: var(--muted); font-size: 0.92rem; }
.nav a:hover { color: var(--text); }

.hero {
  padding: 4.5rem 1.5rem 3.25rem; max-width: 720px;
  background:
    radial-gradient(ellipse 80% 60% at 10% 0%, var(--accent-soft), transparent 55%),
    linear-gradient(180deg, #fff 0%, var(--bg) 100%);
}
.eyebrow { color: var(--accent); text-transform: uppercase; letter-spacing: 0.14em; font-size: 0.72rem; font-weight: 700; }
.hero h1 { font-size: clamp(1.85rem, 4.2vw, 2.85rem); line-height: 1.12; margin: 0.45rem 0 0.85rem; letter-spacing: -0.03em; }
.lead { color: var(--muted); font-size: 1.05rem; line-height: 1.65; }
.actions { display: flex; flex-wrap: wrap; gap: 0.75rem; margin-top: 1.45rem; }

.btn {
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 0.55rem; padding: 0.72rem 1.15rem; border: 1px solid transparent;
  font-weight: 650; cursor: pointer; font-size: 0.95rem;
}
.btn.small { padding: 0.45rem 0.85rem; font-size: 0.85rem; background: var(--text); color: #fff; }
.btn.primary { background: var(--accent); color: #fff; }
.btn.ghost { border-color: var(--line); background: var(--panel); color: var(--text); }
.btn:hover { filter: brightness(1.05); }

.section { padding: 2.75rem 1.5rem; max-width: 980px; margin: 0 auto; }
.section.muted { color: var(--muted); }
.section h2 { margin: 0 0 0.4rem; letter-spacing: -0.02em; }
.section-lead { margin: 0 0 1.25rem; color: var(--muted); }
.grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); }
.card {
  background: var(--panel); border: 1px solid var(--line); border-radius: 0.9rem; padding: 1.2rem;
  box-shadow: 0 10px 28px rgba(26, 28, 31, 0.04);
}
.card h3 { margin: 0 0 0.45rem; font-size: 1.05rem; }
.card p { margin: 0; color: var(--muted); line-height: 1.55; font-size: 0.92rem; }

.cta {
  margin: 0.5rem auto 3rem; padding: 2.1rem; border-radius: 1rem;
  background: var(--panel); border: 1px solid var(--line); max-width: 980px;
}
.cta .btn { margin-top: 1rem; }
.footer {
  padding: 1.4rem 1.5rem 2.4rem; color: var(--muted); font-size: 0.85rem;
  border-top: 1px solid var(--line); text-align: center;
}

@media (max-width: 720px) {
  .header { flex-wrap: wrap; }
  .nav { width: 100%; order: 3; }
  .hero { padding-top: 2.6rem; }
}
`,
};

/** Создаёт React-шаблон тихо (без карточек в чате), если песочница пуста. */
export function ensureReactSiteTemplate(chatId: string): boolean {
  if (listSandboxFiles(chatId).length) return false;
  for (const [path, content] of Object.entries(REACT_TEMPLATE)) {
    writeSandboxFile(chatId, path, content);
  }
  commitSandboxBuild(chatId, 'Шаблон сайта');
  return true;
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
      activity: { id, name, kind: 'list', ok: true, pending: false, after: files.join('\n') },
    };
  }

  if (name === 'read_file') {
    const path = normalizePath(String(args.path || ''));
    const content = readSandboxFile(chatId, path);
    if (content == null) {
      return {
        forModel: JSON.stringify({ error: 'Файл не найден', path }),
        activity: { id, name, kind: 'read', path, ok: false, pending: false, error: 'Файл не найден' },
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
        pending: false,
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
        pending: false,
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
        pending: false,
        error: res.ok ? undefined : res.error,
        before: before ?? '',
        after: '',
      },
    };
  }

  return {
    forModel: JSON.stringify({ error: `Неизвестный tool: ${name}` }),
    activity: { id, name, kind: 'edit', ok: false, pending: false, error: `Неизвестный tool: ${name}` },
  };
}

/** @deprecated use runSandboxTool */
export function executeSandboxTool(chatId: string, name: string, argsJson: string): string {
  return runSandboxTool(chatId, name, argsJson).forModel;
}

/** Превью: JSX собирается в родителе (Babel), в iframe — готовый JS + React UMD */
export function buildPreviewHtml(
  chatId: string,
  buildId: string | 'latest' = 'latest',
): string | null {
  const files = getSandboxFilesAt(chatId, buildId);
  const entry =
    (files['src/App.jsx'] && 'src/App.jsx') ||
    (files['src/App.tsx'] && 'src/App.tsx') ||
    (files['src/App.js'] && 'src/App.js') ||
    (files['App.jsx'] && 'App.jsx') ||
    null;

  const cssParts = [
    files['src/styles.css']?.content,
    files['src/index.css']?.content,
    files['styles.css']?.content,
    files['src/App.css']?.content,
  ].filter(Boolean) as string[];
  const css = cssParts.join('\n');

  if (entry) {
    return buildReactPreviewDocument({
      entryPath: entry,
      files,
      css,
    });
  }

  const index =
    files['index.html']?.content ||
    files['Index.html']?.content ||
    Object.values(files).find((f) => f.path.endsWith('.html') && f.path !== 'index.html')
      ?.content;
  if (!index) return null;
  return buildStaticPreviewDocument(index, files);
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
