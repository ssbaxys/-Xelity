import { useState } from 'react';
import type { ToolActivity } from '../lib/chatStore';
import { compactDiff, diffLines } from '../lib/lineDiff';
import {
  IconCheck,
  IconEye,
  IconFilePlus,
  IconPencil,
  IconSearch,
  IconTrash,
} from './icons';

function KindIcon({
  kind,
  pending,
}: {
  kind: ToolActivity['kind'];
  pending?: boolean;
}) {
  const spin = pending ? 'tool-icon-spin' : '';
  if (kind === 'search') return <IconSearch className={`h-3.5 w-3.5 ${spin}`} />;
  if (kind === 'fetch') return <IconEye className={`h-3.5 w-3.5 ${spin}`} />;
  if (kind === 'read' || kind === 'list') {
    return <IconEye className={`h-3.5 w-3.5 ${spin}`} />;
  }
  if (kind === 'create') return <IconFilePlus className={`h-3.5 w-3.5 ${spin}`} />;
  if (kind === 'delete') return <IconTrash className={`h-3.5 w-3.5 ${spin}`} />;
  return <IconPencil className={`h-3.5 w-3.5 ${spin}`} />;
}

function labelFor(a: ToolActivity): string {
  if (a.kind === 'search') return `Поиск: ${a.path || '…'}`;
  if (a.kind === 'fetch') return `Чтение сайта: ${a.path || '…'}`;
  if (a.kind === 'list') return 'Список файлов';
  if (a.kind === 'read') {
    const range =
      a.startLine && a.endLine ? ` · ${a.startLine}–${a.endLine}` : '';
    return `Чтение ${a.path || ''}${range}`;
  }
  if (a.kind === 'create') return `Создание ${a.path || ''}`;
  if (a.kind === 'delete') return `Удаление ${a.path || ''}`;
  return `Редактирование ${a.path || ''}`;
}

function DiffView({ activity, ok }: { activity: ToolActivity; ok?: boolean }) {
  const before = activity.before ?? '';
  const after = activity.after ?? '';
  const scrollCls = ok ? 'tool-scroll-ok' : activity.ok === false ? 'tool-scroll-err' : '';

  if (activity.kind === 'search' && activity.links?.length) {
    return (
      <ul className={`tool-search-links max-h-64 overflow-auto py-1 ${scrollCls}`}>
        {activity.links.map((l, i) => (
          <li key={`${l.url}-${i}`} className="tool-search-link-item">
            <a href={l.url} target="_blank" rel="noopener noreferrer" className="tool-search-link">
              <span className="tool-search-link-title">{l.title}</span>
              <span className="tool-search-link-url">{l.url}</span>
              {l.snippet ? <span className="tool-search-link-snip">{l.snippet}</span> : null}
            </a>
          </li>
        ))}
      </ul>
    );
  }

  if (
    activity.kind === 'read' ||
    activity.kind === 'list' ||
    activity.kind === 'search' ||
    activity.kind === 'fetch'
  ) {
    const text = after || '';
    if (!text) return <p className="px-3 py-2 text-[11px] text-[var(--c-faint)]">Пусто</p>;
    return (
      <pre
        className={`max-h-56 overflow-auto px-3 py-2 font-mono text-[11px] leading-relaxed text-[var(--c-muted)] ${scrollCls}`}
      >
        {text.slice(0, 12_000)}
      </pre>
    );
  }
  const lines = compactDiff(diffLines(before, after), 3);
  return (
    <div
      className={`max-h-64 overflow-auto font-mono text-[11px] leading-[1.55] ${scrollCls}`}
    >
      {lines.map((l, i) => (
        <div
          key={i}
          className={`tool-diff-line flex gap-2 px-2 py-0.5 ${
            l.type === 'add'
              ? 'tool-diff-add bg-[rgba(46,125,50,0.18)] text-[#a5d6a7]'
              : l.type === 'del'
                ? 'tool-diff-del bg-[rgba(198,40,40,0.16)] text-[#ef9a9a]'
                : 'text-[var(--c-faint)]'
          }`}
          style={{ animationDelay: `${Math.min(i, 12) * 18}ms` }}
        >
          <span className="w-8 shrink-0 select-none text-right opacity-60">
            {l.type === 'add' ? l.newNo ?? '' : l.oldNo ?? ''}
          </span>
          <span className="w-3 shrink-0 select-none opacity-70">
            {l.type === 'add' ? '+' : l.type === 'del' ? '−' : ' '}
          </span>
          <span className="min-w-0 whitespace-pre-wrap break-all">{l.text || ' '}</span>
        </div>
      ))}
    </div>
  );
}

export default function ToolActivityCards({ items }: { items: ToolActivity[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  if (!items.length) return null;

  return (
    <div className="tool-cards mb-3 space-y-1.5">
      {items.map((a, index) => {
        const expanded = openId === a.id;
        const expandable =
          Boolean(a.links?.length) ||
          a.kind === 'search' ||
          a.kind === 'fetch' ||
          a.kind !== 'list' ||
          Boolean(a.after);
        const tone = a.pending
          ? 'tool-card-pending border-[var(--c-border-strong)] bg-[var(--c-soft)]'
          : a.ok
            ? 'tool-card-ok border-[rgba(46,125,50,0.35)] bg-[rgba(46,125,50,0.08)]'
            : 'tool-card-err border-[rgba(198,40,40,0.4)] bg-[rgba(198,40,40,0.1)]';
        return (
          <div
            key={a.id}
            className={`tool-card overflow-hidden rounded-xl border ${tone}`}
            style={{ animationDelay: `${Math.min(index, 8) * 55}ms` }}
          >
            <button
              type="button"
              disabled={!expandable || a.pending}
              onClick={() => setOpenId(expanded ? null : a.id)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-[var(--c-text)] transition-colors duration-200 disabled:cursor-default"
            >
              <span
                className={`tool-card-icon inline-flex shrink-0 ${
                  a.ok && !a.pending
                    ? 'text-[#81c784]'
                    : a.pending
                      ? 'text-[var(--c-muted)]'
                      : 'text-[#e57373]'
                }`}
              >
                <KindIcon kind={a.kind} pending={a.pending} />
              </span>
              <span
                className={`min-w-0 flex-1 truncate font-medium ${
                  a.pending ? 'tool-label-shimmer' : ''
                }`}
              >
                {labelFor(a)}
                {a.pending ? '…' : ''}
              </span>
              {a.pending ? (
                <span className="tool-status-pending text-[10px] tabular-nums text-[var(--c-faint)]">
                  работаю
                </span>
              ) : a.ok ? (
                <span
                  className="tool-status-done inline-flex items-center gap-1 text-[10px] text-[#81c784]"
                  aria-label="готово"
                >
                  <IconCheck className="tool-check-in h-3.5 w-3.5 shrink-0" />
                  {a.kind === 'search' ? null : 'ок'}
                </span>
              ) : (
                <span className="tool-status-fail text-[10px] text-[#e57373]">ошибка</span>
              )}
            </button>
            <div className={`tool-card-body ${expanded && !a.pending ? 'is-open' : ''}`}>
              <div className="tool-card-body-inner border-t border-[var(--c-border)] bg-[var(--c-panel)]">
                {a.error && !a.links?.length ? (
                  <p className="px-3 py-2 text-[11px] text-[#e57373]">{a.error}</p>
                ) : (
                  <DiffView activity={a} ok={a.ok} />
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
