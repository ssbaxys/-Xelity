import { useState } from 'react';
import type { ToolActivity } from '../lib/chatStore';
import { compactDiff, diffLines } from '../lib/lineDiff';
import { IconCheck, IconEye, IconFilePlus, IconPencil, IconTrash } from './icons';

function KindIcon({ kind }: { kind: ToolActivity['kind'] }) {
  if (kind === 'read' || kind === 'list') return <IconEye className="h-3.5 w-3.5" />;
  if (kind === 'create') return <IconFilePlus className="h-3.5 w-3.5" />;
  if (kind === 'delete') return <IconTrash className="h-3.5 w-3.5" />;
  return <IconPencil className="h-3.5 w-3.5" />;
}

function labelFor(a: ToolActivity): string {
  if (a.kind === 'list') return 'Список файлов';
  if (a.kind === 'read') {
    const range =
      a.startLine && a.endLine ? ` · строки ${a.startLine}–${a.endLine}` : '';
    return `Чтение ${a.path || ''}${range}`;
  }
  if (a.kind === 'create') return `Создание ${a.path || ''}`;
  if (a.kind === 'delete') return `Удаление ${a.path || ''}`;
  return `Редактирование ${a.path || ''}`;
}

function DiffView({ activity }: { activity: ToolActivity }) {
  const before = activity.before ?? '';
  const after = activity.after ?? '';
  if (activity.kind === 'read' || activity.kind === 'list') {
    const text = after || '';
    if (!text) return <p className="px-3 py-2 text-[11px] text-[var(--c-faint)]">Пусто</p>;
    return (
      <pre className="max-h-56 overflow-auto px-3 py-2 font-mono text-[11px] leading-relaxed text-[var(--c-muted)]">
        {text.slice(0, 12_000)}
      </pre>
    );
  }
  const lines = compactDiff(diffLines(before, after), 3);
  return (
    <div className="max-h-64 overflow-auto font-mono text-[11px] leading-[1.55]">
      {lines.map((l, i) => (
        <div
          key={i}
          className={`flex gap-2 px-2 py-0.5 ${
            l.type === 'add'
              ? 'tool-diff-add bg-[rgba(46,125,50,0.18)] text-[#a5d6a7]'
              : l.type === 'del'
                ? 'tool-diff-del bg-[rgba(198,40,40,0.16)] text-[#ef9a9a]'
                : 'text-[var(--c-faint)]'
          }`}
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
    <div className="mb-3 space-y-1.5">
      {items.map((a) => {
        const expanded = openId === a.id;
        const expandable = a.kind !== 'list' || Boolean(a.after);
        const tone = a.pending
          ? 'border-[var(--c-border)] bg-[var(--c-soft)]'
          : a.ok
            ? 'border-[rgba(46,125,50,0.35)] bg-[rgba(46,125,50,0.08)]'
            : 'border-[rgba(198,40,40,0.4)] bg-[rgba(198,40,40,0.1)]';
        return (
          <div key={a.id} className={`overflow-hidden rounded-xl border ${tone}`}>
            <button
              type="button"
              disabled={!expandable}
              onClick={() => setOpenId(expanded ? null : a.id)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-[var(--c-text)] disabled:cursor-default"
            >
              <span className={a.ok ? 'text-[#81c784]' : a.pending ? 'text-[var(--c-faint)]' : 'text-[#e57373]'}>
                <KindIcon kind={a.kind} />
              </span>
              <span className="min-w-0 flex-1 truncate font-medium">{labelFor(a)}</span>
              {a.pending ? (
                <span className="text-[10px] text-[var(--c-faint)]">…</span>
              ) : a.ok ? (
                <IconCheck className="h-3.5 w-3.5 shrink-0 text-[#81c784]" />
              ) : (
                <span className="text-[10px] text-[#e57373]">ошибка</span>
              )}
            </button>
            {expanded && (
              <div className="border-t border-[var(--c-border)] bg-[var(--c-panel)]">
                {a.error ? (
                  <p className="px-3 py-2 text-[11px] text-[#e57373]">{a.error}</p>
                ) : (
                  <DiffView activity={a} />
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
