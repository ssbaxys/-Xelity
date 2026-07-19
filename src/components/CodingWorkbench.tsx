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
  /** мобильный оверлей */
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
    <ul className="select-none">
      {nodes.map((n) => {
        if (n.kind === 'dir') {
          const open = expanded[n.path] !== false;
          return (
            <li key={n.path}>
              <button
                type="button"
                onClick={() => onToggle(n.path)}
                className="flex w-full items-center gap-1 rounded-md px-1.5 py-1 text-left text-[12px] text-[var(--c-muted)] hover:bg-[var(--c-hover)] hover:text-[var(--c-text)]"
                style={{ paddingLeft: 6 + depth * 12 }}
              >
                {open ? (
                  <IconChevronDown className="h-3 w-3 shrink-0" />
                ) : (
                  <IconChevronRight className="h-3 w-3 shrink-0" />
                )}
                <span className="truncate font-medium">{n.name}</span>
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
              className={`flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[12px] ${
                selected === n.path
                  ? 'bg-[var(--x-red-soft,rgba(198,40,40,0.12))] text-[var(--c-text)]'
                  : 'text-[var(--c-muted)] hover:bg-[var(--c-hover)] hover:text-[var(--c-text)]'
              }`}
              style={{ paddingLeft: 6 + depth * 12 + 14 }}
            >
              <IconFileCode className="h-3 w-3 shrink-0 opacity-70" />
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

  const panel = (
    <div className="flex h-full min-h-0 flex-col border-l border-[var(--c-border)] bg-[var(--c-panel)]">
      <div className="flex shrink-0 items-center gap-1 border-b border-[var(--c-border)] px-2 py-1.5">
        {(['files', 'preview'] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition ${
              tab === id
                ? 'bg-[var(--x-red-soft,rgba(198,40,40,0.14))] text-[var(--c-text)]'
                : 'text-[var(--c-muted)] hover:bg-[var(--c-hover)] hover:text-[var(--c-text)]'
            }`}
          >
            {id === 'files' ? 'Файлы' : 'Превью'}
          </button>
        ))}
        <div className="flex-1" />
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
          className="rounded-md border border-[var(--c-border)] px-2 py-1 text-[10px] text-[var(--c-muted)] hover:text-[var(--c-text)] disabled:opacity-40"
        >
          ZIP
        </button>
        {onMobileClose && (
          <button
            type="button"
            onClick={onMobileClose}
            className="rounded-md p-1 text-[var(--c-faint)] hover:bg-[var(--c-hover)] hover:text-[var(--c-text)] lg:hidden"
            aria-label="Закрыть"
          >
            <IconClose className="h-4 w-4" />
          </button>
        )}
      </div>

      {error && (
        <p className="border-b border-[var(--c-border)] px-3 py-1.5 text-[11px] text-[#e57373]">{error}</p>
      )}

      {tab === 'preview' ? (
        <div className="min-h-0 flex-1 bg-white">
          {previewHtml ? (
            <iframe
              title="Превью сайта"
              className="h-full w-full border-0"
              sandbox="allow-scripts allow-forms allow-modals"
              srcDoc={previewHtml}
            />
          ) : (
            <p className="p-6 text-center text-[13px] text-[var(--c-faint)]">
              Нет файлов для превью. Отправьте сообщение в режиме «Кодинг».
            </p>
          )}
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-rows-[auto_1fr] sm:grid-rows-1 sm:grid-cols-[minmax(140px,38%)_1fr]">
          <div className="min-h-0 overflow-y-auto border-b border-[var(--c-border)] p-1.5 sm:border-b-0 sm:border-r">
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
              <p className="px-2 py-6 text-center text-[11px] text-[var(--c-faint)]">
                Файлы появятся после первого сообщения в режиме «Кодинг»
              </p>
            )}
          </div>
          <div className="min-h-0 overflow-auto p-3">
            {selected && highlighted != null ? (
              <pre className="m-0 font-mono text-[11px] leading-relaxed">
                <code
                  className="coding-hljs hljs"
                  data-lang={langFromPath(selected)}
                  dangerouslySetInnerHTML={{ __html: highlighted }}
                />
              </pre>
            ) : (
              <p className="font-mono text-[11px] text-[var(--c-faint)]">
                {files.length ? 'Выберите файл' : 'Пусто'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* desktop dock */}
      <aside className="hidden min-h-0 w-[min(42vw,440px)] shrink-0 lg:flex lg:flex-col">{panel}</aside>

      {/* mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-[var(--c-panel)] lg:hidden">
          {panel}
        </div>
      )}
    </>
  );
}
