import { useEffect, useMemo, useState } from 'react';
import {
  buildPreviewHtml,
  downloadSandboxZip,
  listSandboxFiles,
  readSandboxFile,
  subscribeSandbox,
} from '../lib/projectSandbox';
import { IconClose } from './icons';

type Props = {
  chatId: string;
  open: boolean;
  onClose: () => void;
};

export default function CodingPanel({ chatId, open, onClose }: Props) {
  const [tick, setTick] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => subscribeSandbox(() => setTick((n) => n + 1)), []);
  useEffect(() => {
    setSelected(null);
    setPreview(false);
    setError(null);
  }, [chatId]);

  const files = useMemo(() => {
    void tick;
    return listSandboxFiles(chatId);
  }, [chatId, tick]);

  const fileContent = selected ? readSandboxFile(chatId, selected) : null;
  const previewHtml = useMemo(() => {
    void tick;
    return buildPreviewHtml(chatId);
  }, [chatId, tick]);

  if (!open) return null;

  return (
    <div className="ui-sheet fixed inset-x-3 bottom-3 z-[70] mx-auto flex max-h-[min(70vh,560px)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-[var(--c-border-strong)] bg-[var(--c-panel)] shadow-2xl sm:inset-x-auto">
      <div className="flex items-center justify-between gap-2 border-b border-[var(--c-border)] px-3 py-2.5">
        <div>
          <p className="text-[13px] font-semibold text-[var(--c-text)]">Песочница сайта</p>
          <p className="text-[11px] text-[var(--c-faint)]">
            {files.length ? `${files.length} файл(ов)` : 'Пока пусто — попроси ИИ создать index.html'}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={!previewHtml}
            onClick={() => setPreview((v) => !v)}
            className="ui-press rounded-lg border border-[var(--c-border)] px-2.5 py-1.5 text-[11px] text-[var(--c-muted)] hover:bg-[var(--c-hover)] disabled:opacity-40"
          >
            {preview ? 'Код' : 'Превью'}
          </button>
          <button
            type="button"
            disabled={!files.length || busy}
            onClick={() => {
              setBusy(true);
              setError(null);
              void downloadSandboxZip(chatId)
                .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка ZIP'))
                .finally(() => setBusy(false));
            }}
            className="ui-press rounded-lg bg-[#c62828] px-2.5 py-1.5 text-[11px] font-semibold text-white hover:brightness-110 disabled:opacity-40"
          >
            ZIP
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--c-faint)] hover:bg-[var(--c-hover)] hover:text-[var(--c-text)]"
            aria-label="Закрыть"
          >
            <IconClose className="h-4 w-4" />
          </button>
        </div>
      </div>

      {error && (
        <p className="border-b border-[var(--c-border)] px-3 py-2 text-[12px] text-[#e57373]">{error}</p>
      )}

      {preview ? (
        <div className="min-h-0 flex-1 bg-white">
          {previewHtml ? (
            <iframe
              title="Превью сайта"
              className="h-full min-h-[320px] w-full border-0"
              sandbox="allow-scripts allow-forms allow-modals"
              srcDoc={previewHtml}
            />
          ) : (
            <p className="p-6 text-center text-[13px] text-[var(--c-faint)]">Нет index.html для превью</p>
          )}
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[140px_1fr] sm:grid-cols-[180px_1fr]">
          <ul className="overflow-y-auto border-r border-[var(--c-border)] p-1.5">
            {files.map((p) => (
              <li key={p}>
                <button
                  type="button"
                  onClick={() => setSelected(p)}
                  className={`mb-0.5 w-full truncate rounded-md px-2 py-1.5 text-left text-[11px] ${
                    selected === p
                      ? 'bg-[var(--admin-accent-soft,#c6282822)] text-[var(--c-text)]'
                      : 'text-[var(--c-muted)] hover:bg-[var(--c-hover)]'
                  }`}
                >
                  {p}
                </button>
              </li>
            ))}
            {!files.length && (
              <li className="px-2 py-4 text-center text-[11px] text-[var(--c-faint)]">Нет файлов</li>
            )}
          </ul>
          <pre className="overflow-auto p-3 font-mono text-[11px] leading-relaxed text-[var(--c-muted)]">
            {selected && fileContent != null
              ? fileContent
              : files.length
                ? 'Выбери файл слева'
                : 'Файлы появятся после ответов ИИ в режиме «Кодинг»'}
          </pre>
        </div>
      )}
    </div>
  );
}
