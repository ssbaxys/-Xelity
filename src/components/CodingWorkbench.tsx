import { useEffect, useMemo, useState } from 'react';
import { highlightCode, langFromPath } from '../lib/highlightCode';
import {
  buildFileTree,
  buildPreviewHtml,
  downloadSandboxZip,
  listSandboxFiles,
  readSandboxFile,
  subscribeSandbox,
  type FileTreeNode,
} from '../lib/projectSandbox';
import { FileTreeFromItems, type FileTreeNodeData } from './FileTree';
import { IconClose } from './icons';

function usePreviewSrc(html: string | null): string | null {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!html) {
      setSrc(null);
      return;
    }
    const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [html]);
  return src;
}

function toFileTreeItems(nodes: FileTreeNode[]): FileTreeNodeData[] {
  return nodes.map((n) => ({
    id: n.path,
    label: n.name,
    hasChildren: n.kind === 'dir',
    children: n.children?.length ? toFileTreeItems(n.children) : undefined,
  }));
}

function collectDirPaths(nodes: FileTreeNode[], acc: string[] = []): string[] {
  for (const n of nodes) {
    if (n.kind === 'dir') {
      acc.push(n.path);
      if (n.children) collectDirPaths(n.children, acc);
    }
  }
  return acc;
}

type Tab = 'files' | 'preview';

type Props = {
  chatId: string;
  open?: boolean;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
};

export default function CodingWorkbench({
  chatId,
  open = true,
  mobileOpen,
  onMobileClose,
}: Props) {
  const [tick, setTick] = useState(0);
  const [tab, setTab] = useState<Tab>('files');
  const [selected, setSelected] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => subscribeSandbox(() => setTick((n) => n + 1)), []);
  useEffect(() => {
    setSelected(null);
    setTab('files');
    setError(null);
    setExpandedIds([]);
  }, [chatId]);

  const files = useMemo(() => {
    void tick;
    return listSandboxFiles(chatId);
  }, [chatId, tick]);

  const tree = useMemo(() => buildFileTree(files), [files]);
  const items = useMemo(() => toFileTreeItems(tree), [tree]);

  useEffect(() => {
    const dirs = collectDirPaths(tree);
    setExpandedIds((prev) => {
      if (!dirs.length) return [];
      if (!prev.length) return dirs;
      const keep = prev.filter((id) => dirs.includes(id));
      const extras = dirs.filter((id) => !keep.includes(id));
      return extras.length ? [...keep, ...extras] : keep;
    });
  }, [tree]);

  useEffect(() => {
    if (!selected && files.length) {
      const prefer =
        files.find((p) => p === 'src/App.jsx') ||
        files.find((p) => p.endsWith('App.jsx')) ||
        files[0];
      setSelected(prefer);
    }
    if (selected && !files.includes(selected)) setSelected(files[0] ?? null);
  }, [files, selected]);

  const content = selected ? readSandboxFile(chatId, selected) : null;
  const highlighted = useMemo(() => {
    if (content == null || !selected) return null;
    return highlightCode(content, langFromPath(selected));
  }, [content, selected]);
  const previewHtml = useMemo(() => {
    void tick;
    try {
      return buildPreviewHtml(chatId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return `<!DOCTYPE html><html><body style="font:13px sans-serif;padding:16px;color:#c62828"><pre>${msg.replace(/</g, '&lt;')}</pre></body></html>`;
    }
  }, [chatId, tick]);
  const previewSrc = usePreviewSrc(previewHtml);

  const lang = selected ? langFromPath(selected) : undefined;

  const panel = (
    <div className="coding-workbench flex h-full min-h-0 flex-col">
      <header className="coding-wb-header">
        <div className="coding-wb-tabs" role="tablist">
          {(['files', 'preview'] as const).map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`coding-wb-tab ${tab === id ? 'is-active' : ''}`}
            >
              {id === 'files' ? 'Файлы' : 'Превью'}
            </button>
          ))}
        </div>
        <div className="coding-wb-actions">
          <button
            type="button"
            disabled={!files.length || busy}
            onClick={() => {
              setBusy(true);
              setError(null);
              void downloadSandboxZip(chatId)
                .catch((e) => setError(e instanceof Error ? e.message : 'ZIP ошибка'))
                .finally(() => setBusy(false));
            }}
            className="coding-wb-zip"
            title="Скачать ZIP"
          >
            ZIP
          </button>
          {onMobileClose && (
            <button
              type="button"
              onClick={onMobileClose}
              className="coding-wb-close lg:hidden"
              aria-label="Закрыть"
            >
              <IconClose className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

      {error && <p className="coding-wb-error">{error}</p>}

      {tab === 'preview' ? (
        <div className="coding-wb-preview min-h-0 flex-1">
          {previewSrc ? (
            <iframe
              key={previewSrc}
              title="Превью сайта"
              className="h-full w-full min-h-[280px] border-0 bg-white"
              sandbox="allow-scripts allow-forms allow-modals allow-popups allow-same-origin"
              src={previewSrc}
            />
          ) : (
            <div className="coding-wb-empty">
              <p>Нет превью</p>
              <span>Нужен src/App.jsx — включите «Кодинг» и отправьте задачу</span>
            </div>
          )}
        </div>
      ) : (
        <div className="coding-wb-files min-h-0 flex-1">
          <aside className="coding-wb-sidebar">
            <p className="coding-wb-sidebar-label">
              Проект{files.length ? ` · ${files.length}` : ''}
            </p>
            {items.length ? (
              <FileTreeFromItems
                className="coding-file-tree"
                items={items}
                expandedIds={expandedIds}
                onExpandedIdsChange={setExpandedIds}
                selectedIds={selected ? [selected] : []}
                onSelectedIdsChange={(ids) => {
                  const next = ids[0] ?? null;
                  if (next && files.includes(next)) setSelected(next);
                }}
                onNodeClick={(nodeId) => {
                  if (files.includes(nodeId)) setSelected(nodeId);
                }}
                highlightColor="var(--color-signal, #c62828)"
                indentSize={14}
                showIcons
                truncate
              />
            ) : (
              <p className="coding-wb-empty-sm">Файлы появятся после первого ответа</p>
            )}
          </aside>
          <section className="coding-wb-editor">
            {selected && (
              <div className="coding-wb-path">
                <span className="truncate">{selected}</span>
                {lang && <span className="coding-wb-lang">{lang}</span>}
              </div>
            )}
            <div className="coding-wb-code">
              {selected && highlighted != null ? (
                <pre className="m-0">
                  <code
                    className="coding-hljs hljs"
                    dangerouslySetInnerHTML={{ __html: highlighted }}
                  />
                </pre>
              ) : (
                <p className="coding-wb-empty-sm">{files.length ? 'Выберите файл' : 'Пусто'}</p>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );

  return (
    <>
      <aside
        className={`coding-wb-dock hidden min-h-0 shrink-0 lg:flex lg:flex-col ${open ? 'is-visible' : ''}`}
      >
        {panel}
      </aside>
      {mobileOpen && (
        <div className="coding-wb-mobile ui-backdrop fixed inset-0 z-[60] flex flex-col bg-[var(--c-panel)] lg:hidden">
          <div className="coding-wb-mobile-sheet flex min-h-0 flex-1 flex-col">{panel}</div>
        </div>
      )}
    </>
  );
}
