import { useEffect, useMemo, useState } from 'react';
import {
  markBroadcastSeen,
  watchBroadcastSeen,
  watchBroadcasts,
  type Broadcast,
} from '../lib/rtdb';

type Props = {
  uid: string | null;
};

export default function BroadcastBanner({ uid }: Props) {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [seen, setSeen] = useState<Record<string, boolean>>({});
  const [dismissed, setDismissed] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;
    return watchBroadcasts(setBroadcasts);
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    return watchBroadcastSeen(uid, setSeen);
  }, [uid]);

  const pending = useMemo(() => {
    if (!uid) return [];
    return broadcasts.filter((b) => !seen[b.id] && b.id !== dismissed);
  }, [broadcasts, seen, uid, dismissed]);

  const current = pending[0] ?? null;

  if (!uid || !current) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" />
      <div className="relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-[var(--c-border-strong)] bg-[var(--c-panel)] shadow-2xl">
        <div className="border-b border-[var(--c-border)] px-4 py-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-[#c62828]">
            Объявление
            {pending.length > 1 ? ` · ещё ${pending.length - 1}` : ''}
          </p>
          <h2 className="mt-1 text-[15px] font-semibold text-[var(--c-text)]">{current.title}</h2>
        </div>
        <div className="max-h-[40vh] overflow-y-auto px-4 py-3 text-[14px] leading-relaxed text-[var(--c-muted)] whitespace-pre-wrap">
          {current.body}
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--c-border)] px-4 py-3">
          <button
            type="button"
            onClick={() => {
              setDismissed(current.id);
              void markBroadcastSeen(uid, current.id);
            }}
            className="rounded-lg bg-[#c62828] px-4 py-2 text-[13px] font-medium text-white hover:brightness-110"
          >
            Понятно
          </button>
        </div>
      </div>
    </div>
  );
}
