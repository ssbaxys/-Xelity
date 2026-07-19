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

function errorPage(message: string): string {
  return `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>Preview error</title>
<style>body{margin:0;font:13px/1.5 ui-sans-serif,system-ui;background:#141014;color:#f3ecec;padding:16px}pre{white-space:pre-wrap;color:#ef9a9a}</style></head>
<body><p>Ошибка превью</p><pre>${escapeHtml(message)}</pre></body></html>`;
}

export function buildReactPreviewDocument(opts: {
  entryPath: string;
  files: PreviewFiles;
  css: string;
}): string {
  const jsx = `
const { useState, useEffect, useMemo, useRef, useCallback, useId, useReducer, Fragment } = React;
${bundleReactSources(opts.entryPath, opts.files)}
`;
  const compiled = compileJsx(jsx);
  if (!compiled.ok) return errorPage(compiled.error);

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
    rootEl.innerHTML = '<pre style="padding:16px;color:#c62828;white-space:pre-wrap;font:12px/1.45 ui-monospace,monospace">' +
      String(msg).replace(/</g, '&lt;') + '</pre>';
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
