/** Песочница файлов сайта — на чат, в localStorage */

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
const MAX_FILES = 40;
const MAX_FILE_BYTES = 180_000;
const MAX_TOTAL_BYTES = 900_000;

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

export function executeSandboxTool(
  chatId: string,
  name: string,
  argsJson: string,
): string {
  let args: Record<string, unknown> = {};
  try {
    args = argsJson ? (JSON.parse(argsJson) as Record<string, unknown>) : {};
  } catch {
    return JSON.stringify({ error: 'Невалидный JSON arguments' });
  }

  if (name === 'list_files') {
    return JSON.stringify({ files: listSandboxFiles(chatId) });
  }
  if (name === 'read_file') {
    const path = String(args.path || '');
    const content = readSandboxFile(chatId, path);
    if (content == null) return JSON.stringify({ error: 'Файл не найден', path });
    return JSON.stringify({ path: normalizePath(path), content });
  }
  if (name === 'write_file') {
    const path = String(args.path || '');
    const content = String(args.content ?? '');
    const res = writeSandboxFile(chatId, path, content);
    return JSON.stringify(res.ok ? { ok: true, path: normalizePath(path) } : res);
  }
  if (name === 'delete_file') {
    const path = String(args.path || '');
    const res = deleteSandboxFile(chatId, path);
    return JSON.stringify(res.ok ? { ok: true, path: normalizePath(path) } : res);
  }
  return JSON.stringify({ error: `Неизвестный tool: ${name}` });
}

/** Собирает HTML для iframe-превью (статика) */
export function buildPreviewHtml(chatId: string): string | null {
  const box = getSandbox(chatId);
  const index =
    box.files['index.html']?.content ||
    box.files['Index.html']?.content ||
    Object.values(box.files).find((f) => f.path.endsWith('.html'))?.content;
  if (!index) return null;

  let html = index;
  // инлайн относительные css/js как data/blob через inline
  html = html.replace(
    /<link[^>]+href=["']([^"']+\.css)["'][^>]*>/gi,
    (full, href: string) => {
      const p = normalizePath(href);
      const css = box.files[p]?.content;
      if (!css) return full;
      return `<style data-src="${p}">\n${css}\n</style>`;
    },
  );
  html = html.replace(
    /<script([^>]*)src=["']([^"']+\.js)["']([^>]*)><\/script>/gi,
    (full, a1: string, src: string, a2: string) => {
      const p = normalizePath(src);
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
