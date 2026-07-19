import { useEffect, useMemo, useState } from 'react';
import {
  markBroadcastSeen,
  watchBroadcastSeen,
  watchBroadcasts,
  type Broadcast,
  type BroadcastKind,
} from '../lib/rtdb';
import ChatMarkdown from './ChatMarkdown';

type Props = {
  uid: string | null;
};

const KIND_LABEL: Record<BroadcastKind, string> = {
  news: 'Новости',
  update: 'Обновление',
  alert: 'Важно',
};

function kindLabel(b: Broadcast): string {
  if (b.eyebrow?.trim()) return b.eyebrow.trim();
  const k = b.kind || 'news';
  return `Xelity · ${KIND_LABEL[k] || KIND_LABEL.news}`;
}

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

  const isAlert = current.kind === 'alert';
  const dateStr = new Date(current.createdAt).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="broadcast-overlay fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-ink/55 backdrop-blur-[3px]" aria-hidden />
      <article
        className={`broadcast-card relative z-10 w-full max-w-lg overflow-hidden ${
          isAlert ? 'broadcast-card--alert' : ''
        }`}
        role="dialog"
        aria-labelledby="broadcast-title"
        aria-modal="true"
      >
        {current.bannerUrl ? (
          <div className="broadcast-banner-media">
            <img src={current.bannerUrl} alt="" />
            <div className="broadcast-banner-veil" aria-hidden />
          </div>
        ) : (
          <div className="broadcast-banner-hero" aria-hidden>
            <div className="broadcast-banner-noise" />
          </div>
        )}

        <div className="broadcast-card-body">
          <p className="broadcast-eyebrow">
            {kindLabel(current)}
            {pending.length > 1 ? ` · ещё ${pending.length - 1}` : ''}
          </p>
          <div className="broadcast-rule" aria-hidden />
          <h2 id="broadcast-title" className="broadcast-title font-display">
            {current.title}
          </h2>
          <p className="broadcast-date">{dateStr}</p>

          <div className="broadcast-md">
            <ChatMarkdown content={current.body} className="broadcast-md-inner" />
          </div>

          <div className="broadcast-actions">
            <button
              type="button"
              onClick={() => {
                setDismissed(current.id);
                void markBroadcastSeen(uid, current.id);
              }}
              className="broadcast-cta"
            >
              {current.ctaLabel?.trim() || 'Понятно'}
            </button>
          </div>
        </div>
      </article>
    </div>
  );
}
