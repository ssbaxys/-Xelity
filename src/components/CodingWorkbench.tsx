import { useEffect, useMemo, useState } from 'react';
import { isChatGenerating } from '../lib/chatGeneration';
import { highlightCode, langFromPath } from '../lib/highlightCode';
import {
  buildFileTree,
  buildPreviewHtml,
  checkSandboxBuild,
  downloadSandboxZip,
  getSandboxFilesAt,
  listSandboxBuilds,
  listSandboxFiles,
  subscribeSandbox,
  type FileTreeNode,
  type SandboxBuild,
} from '../lib/projectSandbox';
import { FileTreeFromItems, type FileTreeNodeData } from './FileTree';
import { IconClose } from './icons';
import SiteDevelopingOverlay from './SiteDevelopingOverlay';

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

function formatBuildTime(ts: number) {
  try {
    return new Date(ts).toLocaleString('ru-RU', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

type Tab = 'files' | 'preview';

type Props = {
  chatId: string;
  open?: boolean;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  /** Идёт генерация ответа с кодингом */
  developing?: boolean;
};

export default function CodingWorkbench({
  chatId,
  open = true,
  mobileOpen,
  onMobileClose,
  developing = false,
}: Props) {
  const [tick, setTick] = useState(0);
  const [tab, setTab] = useState<Tab>('preview');
  const [selected, setSelected] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** 'latest' = живая рабочая версия; иначе id сборки */
  const [viewBuildId, setViewBuildId] = useState<string | 'latest'>('latest');
  const [buildsOpen, setBuildsOpen] = useState(false);

  useEffect(() => subscribeSandbox(() => setTick((n) => n + 1)), []);
  useEffect(() => {
    setSelected(null);
    setTab('preview');
    setError(null);
    setExpandedIds([]);
    setViewBuildId('latest');
    setBuildsOpen(false);
  }, [chatId]);

  const builds = useMemo(() => {
    void tick;
    return listSandboxBuilds(chatId);
  }, [chatId, tick]);

  const viewingLatest = viewBuildId === 'latest';
  const activeBuild: SandboxBuild | null = viewingLatest
    ? null
    : builds.find((b) => b.id === viewBuildId) ?? null;

  useEffect(() => {
    if (developing && viewingLatest) setTab('preview');
  }, [developing, viewingLatest]);

  // Если выбранная сборка исчезла — вернуться к latest
  useEffect(() => {
    if (viewBuildId !== 'latest' && !builds.some((b) => b.id === viewBuildId)) {
      setViewBuildId('latest');
    }
  }, [builds, viewBuildId]);

  const files = useMemo(() => {
    void tick;
    if (viewingLatest) return listSandboxFiles(chatId);
    return Object.keys(getSandboxFilesAt(chatId, viewBuildId)).sort();
  }, [chatId, tick, viewBuildId, viewingLatest]);

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

  const content = useMemo(() => {
    void tick;
    if (!selected) return null;
    const map = getSandboxFilesAt(chatId, viewBuildId);
    return map[selected]?.content ?? null;
  }, [chatId, selected, tick, viewBuildId]);

  const highlighted = useMemo(() => {
    if (content == null || !selected) return null;
    return highlightCode(content, langFromPath(selected));
  }, [content, selected]);

  const buildCheck = useMemo(() => {
    void tick;
    try {
      return checkSandboxBuild(chatId, viewBuildId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        ok: false as const,
        entry: null,
        mode: 'empty' as const,
        errors: [{ message: msg }],
        summary: msg,
      };
    }
  }, [chatId, tick, viewBuildId]);

  const previewHtml = useMemo(() => {
    void tick;
    try {
      return buildPreviewHtml(chatId, viewBuildId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return `<!DOCTYPE html><html><body style="font:13px sans-serif;padding:16px;color:#c62828"><pre>${msg.replace(/</g, '&lt;')}</pre></body></html>`;
    }
  }, [chatId, tick, viewBuildId]);
  const previewSrc = usePreviewSrc(previewHtml);

  const genNow = developing || isChatGenerating(chatId);
  const showDevOverlay = genNow && viewingLatest && tab === 'preview';
  const showBgHint = genNow && !viewingLatest;

  const lang = selected ? langFromPath(selected) : undefined;

  const buildLabel = viewingLatest
    ? builds.length
      ? `Актуальная · #${builds[0].index}`
      : 'Актуальная'
    : activeBuild
      ? `${activeBuild.label} · #${activeBuild.index}`
      : 'Сборка';

  const panel = (
    <div className="coding-workbench flex h-full min-h-0 flex-col">
      <header className="coding-wb-header">
        <div className="coding-wb-tabs" role="tablist">
          {(['preview', 'files'] as const).map((id) => (
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
          <div className="coding-wb-builds">
            <button
              type="button"
              className={`coding-wb-build-btn ${!viewingLatest ? 'is-historic' : ''}`}
              onClick={() => setBuildsOpen((v) => !v)}
              aria-expanded={buildsOpen}
              title="История сборок"
            >
              {buildLabel}
              <svg className="h-3 w-3 opacity-70" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {buildsOpen && (
              <div className="coding-wb-build-menu" role="listbox">
                <button
                  type="button"
                  role="option"
                  className={`coding-wb-build-item ${viewingLatest ? 'is-active' : ''}`}
                  onClick={() => {
                    setViewBuildId('latest');
                    setBuildsOpen(false);
                  }}
                >
                  <span>Актуальная версия</span>
                  <span className="coding-wb-build-meta">рабочие файлы</span>
                </button>
                {builds.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    role="option"
                    className={`coding-wb-build-item ${viewBuildId === b.id ? 'is-active' : ''}`}
                    onClick={() => {
                      setViewBuildId(b.id);
                      setBuildsOpen(false);
                      setTab('preview');
                    }}
                  >
                    <span>
                      #{b.index} · {b.label}
                    </span>
                    <span className="coding-wb-build-meta">{formatBuildTime(b.createdAt)}</span>
                  </button>
                ))}
                {!builds.length && (
                  <p className="coding-wb-build-empty">Сборки появятся после правок сайта</p>
                )}
              </div>
            )}
          </div>
          <button
            type="button"
            disabled={!files.length || busy || !viewingLatest}
            onClick={() => {
              setBusy(true);
              setError(null);
              void downloadSandboxZip(chatId)
                .catch((e) => setError(e instanceof Error ? e.message : 'ZIP ошибка'))
                .finally(() => setBusy(false));
            }}
            className="coding-wb-zip"
            title={viewingLatest ? 'Скачать ZIP актуальной версии' : 'ZIP только для актуальной версии'}
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
      {showBgHint && (
        <p className="coding-wb-bg-hint">
          Сайт обновляется в фоне · вы смотрите прошлую сборку
        </p>
      )}

      {tab === 'preview' ? (
        <div className="coding-wb-preview min-h-0 flex-1">
          <div
            className={`coding-wb-build-status ${
              buildCheck.ok ? 'is-ok' : 'is-err'
            }`}
            title={buildCheck.summary}
          >
            <span className="coding-wb-build-dot" aria-hidden />
            <span className="coding-wb-build-status-text">
              {buildCheck.ok
                ? buildCheck.mode === 'static'
                  ? 'Превью · static'
                  : `Сборка OK${buildCheck.entry ? ` · ${buildCheck.entry}` : ''}`
                : `Ошибка сборки${
                    buildCheck.errors[0]?.file
                      ? ` · ${buildCheck.errors[0].file}${
                          buildCheck.errors[0].line != null
                            ? `:${buildCheck.errors[0].line}`
                            : ''
                        }`
                      : ''
                  }`}
            </span>
            {!buildCheck.ok && buildCheck.errors[0]?.message ? (
              <span className="coding-wb-build-status-msg">
                {buildCheck.errors[0].message.slice(0, 120)}
              </span>
            ) : null}
          </div>
          {previewSrc ? (
            <iframe
              key={`${previewSrc}-${viewBuildId}`}
              title="Превью сайта"
              className={`h-full w-full min-h-[280px] border-0 bg-black ${
                showDevOverlay ? 'is-hidden-build' : ''
              }`}
              sandbox="allow-scripts allow-forms allow-modals allow-popups allow-same-origin"
              src={previewSrc}
            />
          ) : (
            <div className="coding-wb-empty">
              <p>Нет превью</p>
              <span>Включите «Кодинг» — появится шаблон сайта</span>
            </div>
          )}
          <SiteDevelopingOverlay active={showDevOverlay} background={showBgHint && tab === 'preview'} />
        </div>
      ) : (
        <div className="coding-wb-files min-h-0 flex-1">
          <aside className="coding-wb-sidebar">
            <p className="coding-wb-sidebar-label">
              {viewingLatest ? 'Проект' : `Сборка #${activeBuild?.index ?? '—'}`}
              {files.length ? ` · ${files.length}` : ''}
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
              <p className="coding-wb-empty-sm">Файлы появятся после включения кодинга</p>
            )}
          </aside>
          <section className="coding-wb-editor">
            {selected && (
              <div className="coding-wb-path">
                <span className="truncate">{selected}</span>
                {lang && <span className="coding-wb-lang">{lang}</span>}
                {!viewingLatest && <span className="coding-wb-lang">read-only</span>}
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
