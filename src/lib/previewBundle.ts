/**
 * Сборка превью React-песочницы: JSX → JS в родителе (@babel/standalone),
 * без type="text/babel" в iframe (там оно часто не срабатывает).
 */
import * as Babel from '@babel/standalone';

export type PreviewFiles = Record<string, { content: string }>;

function normalizePath(path: string): string {
  return path
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\.\./g, '')
    .trim();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeStyle(css: string): string {
  return css.replace(/<\/style/gi, '<\\/style');
}

function utf8ToBase64(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary);
}

function escapeScript(src: string): string {
  return src.replace(/<\/script/gi, '<\\/script');
}

function resolveSandboxModule(
  fromPath: string,
  spec: string,
  files: PreviewFiles,
): string | null {
  if (!spec.startsWith('.')) return null;
  const fromDir = fromPath.includes('/') ? fromPath.replace(/\/[^/]+$/, '') : '';
  const joined = normalizePath(`${fromDir ? `${fromDir}/` : ''}${spec}`);
  const parts = joined.split('/');
  const stack: string[] = [];
  for (const p of parts) {
    if (!p || p === '.') continue;
    if (p === '..') stack.pop();
    else stack.push(p);
  }
  const base = stack.join('/');
  for (const c of [
    base,
    `${base}.jsx`,
    `${base}.js`,
    `${base}.tsx`,
    `${base}.ts`,
    `${base}/index.jsx`,
    `${base}/index.js`,
  ]) {
    if (files[c]) return c;
  }
  return null;
}

/** Собирает локальные модули в один JSX-файл */
export function bundleReactSources(entryPath: string, files: PreviewFiles): string {
  const visited = new Set<string>();
  const chunks: string[] = [];

  const walk = (path: string) => {
    const norm = normalizePath(path);
    if (visited.has(norm) || !files[norm]) return;
    visited.add(norm);

    let src = files[norm].content.replace(/\r\n/g, '\n');

    const importRe =
      /^\s*import\s+(?:([\w*{}\s,]+)\s+from\s+)?['"](\.[^'"]+)['"]\s*;?\s*$/gm;
    let m: RegExpExecArray | null;
    while ((m = importRe.exec(src))) {
      const mod = resolveSandboxModule(norm, m[2], files);
      if (mod) walk(mod);
    }

    src = src
      // css / asset side-effect imports
      .replace(/^\s*import\s+['"][^'"]+\.(css|scss|sass|less)['"]\s*;?\s*$/gm, '')
      .replace(/^\s*import\s+.+?;?\s*$/gm, '')
      .replace(/^\s*export\s+\{[^}]*\}\s*;?\s*$/gm, '')
      .replace(/export\s+default\s+function\s+(\w+)/g, 'function $1')
      .replace(/export\s+default\s+class\s+(\w+)/g, 'class $1')
      .replace(/export\s+default\s+/g, 'const App = ')
      .replace(/export\s+(async\s+)?function\s+/g, '$1function ')
      .replace(/export\s+(const|let|var|class)\s+/g, '$1 ');

    chunks.push(`/* ${norm} */\n${src}`);
  };

  walk(entryPath);
  let body = chunks.join('\n\n');
  if (!/function App\b|const App\s*=|class App\b/.test(body)) {
    body += `
function App() {
  return React.createElement('div', { style: { padding: 16, fontFamily: 'sans-serif' } },
    'Не найден компонент App. Экспортируйте default function App в src/App.jsx');
}`;
  }
  return body;
}

export type PreviewBuildError = {
  message: string;
  file?: string;
  line?: number;
  column?: number;
};

export type PreviewBuildCheck = {
  ok: boolean;
  entry: string | null;
  mode: 'react' | 'static' | 'empty';
  errors: PreviewBuildError[];
  /** краткий отчёт для агента / карточки */
  summary: string;
};

function parseBabelLoc(message: string): Pick<PreviewBuildError, 'line' | 'column'> {
  // "Unexpected token (12:5)" или "... (12:5)."
  const m = /\((\d+):(\d+)\)/.exec(message);
  if (!m) return {};
  return { line: Number(m[1]), column: Number(m[2]) };
}

function guessFileFromBundledSource(
  message: string,
  bundled: string,
): string | undefined {
  const loc = parseBabelLoc(message);
  if (!loc.line) return undefined;
  const lines = bundled.split('\n');
  let file: string | undefined;
  for (let i = 0; i < Math.min(loc.line, lines.length); i++) {
    const mark = /^\/\*\s*(.+?)\s*\*\/\s*$/.exec(lines[i] || '');
    if (mark) file = mark[1];
  }
  return file;
}

function compileJsx(jsx: string): { ok: true; code: string } | { ok: false; error: string } {
  try {
    const result = Babel.transform(jsx, {
      presets: [['react', { runtime: 'classic', development: false }]],
      filename: 'PreviewApp.jsx',
      babelrc: false,
      configFile: false,
      sourceType: 'script',
    });
    if (!result?.code) return { ok: false, error: 'Пустой результат Babel' };
    return { ok: true, code: result.code };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

function errorPage(errors: PreviewBuildError[]): string {
  const items = errors
    .map((e) => {
      const where = [e.file, e.line != null ? `стр. ${e.line}` : null, e.column != null ? `кол. ${e.column}` : null]
        .filter(Boolean)
        .join(' · ');
      return `<li><div class="msg">${escapeHtml(e.message)}</div>${
        where ? `<div class="where">${escapeHtml(where)}</div>` : ''
      }</li>`;
    })
    .join('');
  return `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Ошибка сборки</title>
<style>
  body{margin:0;min-height:100%;font:13px/1.5 "Segoe UI",system-ui,sans-serif;background:linear-gradient(160deg,#1a1214,#120e10 55%,#0e0c0d);color:#f3ecec}
  .wrap{padding:1.25rem 1.35rem 2rem;max-width:36rem}
  .badge{display:inline-flex;align-items:center;gap:.4rem;padding:.28rem .55rem;border-radius:999px;background:rgba(198,40,40,.18);color:#ef9a9a;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase}
  h1{margin:.7rem 0 .35rem;font-size:1.15rem;letter-spacing:-.02em}
  p{margin:0 0 1rem;color:#b9a8a8}
  ul{list-style:none;margin:0;padding:0;display:grid;gap:.65rem}
  li{border:1px solid rgba(239,154,154,.28);background:rgba(198,40,40,.1);border-radius:.75rem;padding:.75rem .85rem}
  .msg{white-space:pre-wrap;color:#ffcdd2;font-family:ui-monospace,Consolas,monospace;font-size:12px}
  .where{margin-top:.35rem;color:#c8a0a0;font-size:11px}
</style></head>
<body><div class="wrap">
  <span class="badge">Сборка превью</span>
  <h1>Не удалось собрать сайт</h1>
  <p>Исправьте ошибки ниже — превью обновится автоматически.</p>
  <ul>${items || '<li><div class="msg">Неизвестная ошибка сборки</div></li>'}</ul>
</div></body></html>`;
}

/** Проверка той же сборки, что и превью (без запуска iframe). */
export function checkReactPreviewBuild(files: PreviewFiles): PreviewBuildCheck {
  const entry =
    (files['src/App.jsx'] && 'src/App.jsx') ||
    (files['src/App.tsx'] && 'src/App.tsx') ||
    (files['src/App.js'] && 'src/App.js') ||
    (files['App.jsx'] && 'App.jsx') ||
    null;

  if (!entry) {
    const hasHtml = Boolean(
      files['index.html']?.content ||
        files['Index.html']?.content ||
        Object.keys(files).some((p) => p.toLowerCase().endsWith('.html')),
    );
    if (hasHtml) {
      return {
        ok: true,
        entry: 'index.html',
        mode: 'static',
        errors: [],
        summary: 'Статическое превью (index.html) — синтаксис React не проверяется.',
      };
    }
    return {
      ok: false,
      entry: null,
      mode: 'empty',
      errors: [
        {
          message:
            'Нет точки входа: добавьте src/App.jsx (React) или index.html для статического превью.',
        },
      ],
      summary: 'Ошибка: нет src/App.jsx и index.html',
    };
  }

  const bundled = bundleReactSources(entry, files);
  const jsx = `
const { useState, useEffect, useMemo, useRef, useCallback, useId, useReducer, Fragment } = React;
${bundled}
`;
  const compiled = compileJsx(jsx);
  if (!compiled.ok) {
    const loc = parseBabelLoc(compiled.error);
    const file = guessFileFromBundledSource(compiled.error, bundled) || entry;
    const err: PreviewBuildError = {
      message: compiled.error,
      file,
      ...loc,
    };
    return {
      ok: false,
      entry,
      mode: 'react',
      errors: [err],
      summary: `Ошибка сборки${file ? ` в ${file}` : ''}${loc.line != null ? `:${loc.line}` : ''}: ${compiled.error}`,
    };
  }

  if (!/\bApp\b/.test(compiled.code) && !/function App\b|const App\s*=|class App\b/.test(bundled)) {
    const err: PreviewBuildError = {
      message: 'Компонент App не найден. Экспортируйте default function App из точки входа.',
      file: entry,
    };
    return {
      ok: false,
      entry,
      mode: 'react',
      errors: [err],
      summary: err.message,
    };
  }

  return {
    ok: true,
    entry,
    mode: 'react',
    errors: [],
    summary: `Сборка OK · ${entry}`,
  };
}

export function buildReactPreviewDocument(opts: {
  entryPath: string;
  files: PreviewFiles;
  css: string;
}): string {
  const check = checkReactPreviewBuild(opts.files);
  if (!check.ok) return errorPage(check.errors);

  const jsx = `
const { useState, useEffect, useMemo, useRef, useCallback, useId, useReducer, Fragment } = React;
${bundleReactSources(opts.entryPath, opts.files)}
`;
  const compiled = compileJsx(jsx);
  if (!compiled.ok) {
    return errorPage([
      {
        message: compiled.error,
        file: opts.entryPath,
        ...parseBabelLoc(compiled.error),
      },
    ]);
  }

  const codeB64 = utf8ToBase64(compiled.code);

  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Preview</title>
<style>
html, body, #root { margin: 0; min-height: 100%; height: 100%; }
body { background: #fff; }
${escapeStyle(opts.css)}
</style>
</head>
<body>
<div id="root"></div>
<script type="application/json" id="xelity-preview-code">${codeB64}</script>
<script>
(function () {
  var rootEl = document.getElementById('root');
  function showErr(msg) {
    if (!rootEl) return;
    var safe = String(msg).replace(/</g, '&lt;');
    rootEl.innerHTML =
      '<div style="min-height:100%;padding:1.25rem;font:13px/1.5 Segoe UI,system-ui,sans-serif;background:linear-gradient(160deg,#1a1214,#120e10);color:#f3ecec">' +
      '<div style="display:inline-block;padding:0.25rem 0.55rem;border-radius:999px;background:rgba(198,40,40,.18);color:#ef9a9a;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase">Runtime</div>' +
      '<h1 style="margin:0.7rem 0 0.4rem;font-size:1.1rem">Ошибка при запуске</h1>' +
      '<pre style="margin:0;padding:0.85rem;border-radius:0.75rem;border:1px solid rgba(239,154,154,.28);background:rgba(198,40,40,.1);white-space:pre-wrap;color:#ffcdd2;font:12px/1.45 ui-monospace,Consolas,monospace">' +
      safe +
      '</pre></div>';
  }
  window.addEventListener('error', function (e) {
    showErr((e.error && e.error.stack) || e.message || 'Script error');
  });
  window.addEventListener('unhandledrejection', function (e) {
    showErr((e.reason && (e.reason.stack || e.reason.message)) || String(e.reason));
  });

  function b64ToUtf8(b64) {
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  }

  var reactSrcs = [
    'https://cdn.jsdelivr.net/npm/react@18.3.1/umd/react.production.min.js',
    'https://unpkg.com/react@18.3.1/umd/react.production.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js'
  ];
  var domSrcs = [
    'https://cdn.jsdelivr.net/npm/react-dom@18.3.1/umd/react-dom.production.min.js',
    'https://unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js'
  ];

  function loadOne(list) {
    return new Promise(function (resolve, reject) {
      var i = 0;
      function tryNext() {
        if (i >= list.length) {
          reject(new Error('Не удалось загрузить React с CDN. Проверьте сеть / блокировщик.'));
          return;
        }
        var s = document.createElement('script');
        s.src = list[i++];
        s.crossOrigin = 'anonymous';
        s.onload = function () { resolve(); };
        s.onerror = function () { tryNext(); };
        document.head.appendChild(s);
      }
      tryNext();
    });
  }

  loadOne(reactSrcs)
    .then(function () { return loadOne(domSrcs); })
    .then(function () {
      if (typeof React === 'undefined' || typeof ReactDOM === 'undefined') {
        throw new Error('React / ReactDOM не загрузились');
      }
      var raw = document.getElementById('xelity-preview-code');
      var code = b64ToUtf8((raw && raw.textContent) || '');
      var run = document.createElement('script');
      run.text = code;
      document.body.appendChild(run);
      if (typeof App === 'undefined') {
        throw new Error('Компонент App не определён после сборки');
      }
      var mount = ReactDOM.createRoot(rootEl);
      mount.render(React.createElement(App));
    })
    .catch(function (err) {
      showErr(err && err.message ? err.message : String(err));
    });
})();
<\/script>
</body>
</html>`;
}

export function buildStaticPreviewDocument(
  indexHtml: string,
  files: PreviewFiles,
): string {
  let html = indexHtml;
  html = html.replace(/<link[^>]+href=["']([^"']+\.css)["'][^>]*>/gi, (full, href: string) => {
    const p = normalizePath(String(href).replace(/^\//, ''));
    const fileCss = files[p]?.content || files[`src/${p}`]?.content;
    if (!fileCss) return full;
    return `<style data-src="${p}">\n${escapeStyle(fileCss)}\n</style>`;
  });
  html = html.replace(
    /<script([^>]*)type=["']module["']([^>]*)src=["']([^"']+)["']([^>]*)><\/script>/gi,
    () =>
      `<!-- Vite module отключён в превью: нужен src/App.jsx для React CDN preview -->`,
  );
  html = html.replace(
    /<script([^>]*)src=["']([^"']+\.jsx?)["']([^>]*)><\/script>/gi,
    () => '<!-- jsx: используйте src/App.jsx -->',
  );
  html = html.replace(
    /<script([^>]*)src=["']([^"']+\.js)["']([^>]*)><\/script>/gi,
    (full, a1: string, src: string, a2: string) => {
      const p = normalizePath(String(src).replace(/^\//, ''));
      const js = files[p]?.content;
      if (!js) return full;
      return `<script${a1}${a2}>\n${escapeScript(js)}\n</script>`;
    },
  );
  return html;
}
