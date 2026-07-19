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
import { IconChevronDown, IconChevronRight, IconClose, IconFileCode } from './icons';

type Tab = 'files' | 'preview';

type Props = {
  chatId: string;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
};

function Tree({
  nodes,
  depth,
  selected,
  expanded,
  onToggle,
  onSelect,
}: {
  nodes: FileTreeNode[];
  depth: number;
  selected: string | null;
  expanded: Record<string, boolean>;
  onToggle: (path: string) => void;
  onSelect: (path: string) => void;
}) {
  return (
    <ul className="coding-tree select-none">
      {nodes.map((n) => {
        if (n.kind === 'dir') {
          const open = expanded[n.path] !== false;
          return (
            <li key={n.path}>
              <button
                type="button"
                onClick={() => onToggle(n.path)}
                className="coding-tree-item coding-tree-dir"
                style={{ paddingLeft: 8 + depth * 12 }}
              >
                {open ? (
                  <IconChevronDown className="h-3 w-3 shrink-0 opacity-70" />
                ) : (
                  <IconChevronRight className="h-3 w-3 shrink-0 opacity-70" />
                )}
                <span className="truncate">{n.name}</span>
              </button>
              {open && n.children && (
                <Tree
                  nodes={n.children}
                  depth={depth + 1}
                  selected={selected}
                  expanded={expanded}
                  onToggle={onToggle}
                  onSelect={onSelect}
                />
              )}
            </li>
          );
        }
        return (
          <li key={n.path}>
            <button
              type="button"
              onClick={() => onSelect(n.path)}
              className={`coding-tree-item ${selected === n.path ? 'is-active' : ''}`}
              style={{ paddingLeft: 8 + depth * 12 + 16 }}
            >
              <IconFileCode className="h-3 w-3 shrink-0 opacity-60" />
              <span className="truncate">{n.name}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export default function CodingWorkbench({ chatId, mobileOpen, onMobileClose }: Props) {
  const [tick, setTick] = useState(0);
  const [tab, setTab] = useState<Tab>('files');
  const [selected, setSelected] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => subscribeSandbox(() => setTick((n) => n + 1)), []);
  useEffect(() => {
    setSelected(null);
    setTab('files');
    setError(null);
  }, [chatId]);

  const files = useMemo(() => {
    void tick;
    return listSandboxFiles(chatId);
  }, [chatId, tick]);

  const tree = useMemo(() => buildFileTree(files), [files]);

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
    return buildPreviewHtml(chatId);
  }, [chatId, tick]);

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
          {previewHtml ? (
            <iframe
              title="Превью сайта"
              className="h-full w-full border-0"
              sandbox="allow-scripts allow-forms allow-modals"
              srcDoc={previewHtml}
            />
          ) : (
            <div className="coding-wb-empty">
              <p>Нет превью</p>
              <span>Отправьте сообщение в режиме «Кодинг»</span>
            </div>
          )}
        </div>
      ) : (
        <div className="coding-wb-files min-h-0 flex-1">
          <aside className="coding-wb-sidebar">
            <p className="coding-wb-sidebar-label">
              Проект{files.length ? ` · ${files.length}` : ''}
            </p>
            {tree.length ? (
              <Tree
                nodes={tree}
                depth={0}
                selected={selected}
                expanded={expanded}
                onToggle={(path) =>
                  setExpanded((prev) => ({
                    ...prev,
                    [path]: prev[path] === false,
                  }))
                }
                onSelect={setSelected}
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
      <aside className="coding-wb-dock hidden min-h-0 shrink-0 lg:flex lg:flex-col">{panel}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-[var(--c-panel)] lg:hidden">{panel}</div>
      )}
    </>
  );
}
