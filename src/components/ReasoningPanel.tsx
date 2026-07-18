import { useEffect, useState } from 'react';
import { IconChevronDown } from './icons';

function formatThinkDuration(ms: number): string {
  const sec = Math.max(1, Math.round(ms / 1000));
  if (sec < 60) return `${sec} сек`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m} мин ${s} сек` : `${m} мин`;
}

type Props = {
  reasoning?: string | null;
  reasoningMs?: number | null;
  thinkingPhase?: 'thinking' | 'answering' | null;
  startedAt: number;
};

/** Свёрнутый блок «Думает… / Думал N сек» + серые мысли на втором плане */
export default function ReasoningPanel({
  reasoning,
  reasoningMs,
  thinkingPhase,
  startedAt,
}: Props) {
  const live = thinkingPhase === 'thinking' || thinkingPhase === 'answering';
  const [open, setOpen] = useState(live);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!live) {
      setOpen(false);
      return;
    }
    setOpen(true);
    const id = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, [live, thinkingPhase]);

  const elapsedMs = live
    ? Math.max(0, Date.now() - startedAt)
    : typeof reasoningMs === 'number'
      ? reasoningMs
      : 0;

  // tick used to re-render live timer
  void tick;

  const hasText = Boolean(reasoning?.trim());
  if (!live && !hasText) return null;

  const label = live
    ? thinkingPhase === 'answering'
      ? `Думал ${formatThinkDuration(elapsedMs)} · пишу ответ…`
      : `Думает… ${formatThinkDuration(elapsedMs)}`
    : `Думал ${formatThinkDuration(elapsedMs)}`;

  return (
    <div className="mb-2.5 max-w-[min(100%,42rem)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group inline-flex items-center gap-1 rounded-md py-0.5 text-[12px] text-[var(--c-faint)] transition hover:text-[var(--c-muted)]"
        aria-expanded={open}
      >
        <IconChevronDown
          className={`h-3 w-3 shrink-0 transition-transform duration-200 ${open ? 'rotate-0' : '-rotate-90'}`}
        />
        <span className={live ? 'thinking-label' : ''}>{label}</span>
      </button>

      <div
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="mt-1.5 border-l border-[var(--c-border)] pl-3 text-[12.5px] leading-relaxed text-[var(--c-faint)]">
            {hasText ? (
              <p className="whitespace-pre-wrap">{reasoning}</p>
            ) : live ? (
              <p className="thinking-label opacity-70">Собираю мысли…</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
