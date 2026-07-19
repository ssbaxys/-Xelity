import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { createTicket, formatBanCountdown } from '../lib/rtdb';
import { setPageMeta } from '../lib/seo';

export default function BannedPage() {
  const { user, profile, isBanned, logout } = useAuth();
  const [now, setNow] = useState(Date.now());
  const [appealOpen, setAppealOpen] = useState(false);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setPageMeta({
      title: 'Доступ ограничен',
      path: '/banned',
      noindex: true,
    });
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  if (!user || !isBanned || !profile) {
    return null;
  }

  const reason = (profile.banReason || '').trim() || 'Нарушение правил сервиса';
  const until = typeof profile.banUntil === 'number' && profile.banUntil > 0 ? profile.banUntil : null;
  const permanent = until == null;
  const msLeft = until ? Math.max(0, until - now) : 0;

  const onAppeal = async (e: FormEvent) => {
    e.preventDefault();
    if (!body.trim()) {
      setError('Опишите, почему бан следует снять.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createTicket({
        uid: user.uid,
        email: (user.email || '').toLowerCase(),
        subject: 'Апелляция блокировки',
        category: 'appeal',
        priority: 'high',
        body: body.trim(),
        authorName: user.displayName || user.email || 'User',
      });
      setSent(true);
      setAppealOpen(false);
      setBody('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="chat-app flex min-h-screen items-center justify-center bg-[var(--c-bg)] px-4 py-10 text-[var(--c-text)]">
      <div className="w-full max-w-lg rounded-2xl border border-[var(--c-border)] bg-[var(--c-panel)] p-6 shadow-2xl sm:p-8">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-signal">
          Xelity
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Доступ ограничен</h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--c-muted)]">
          Доступ к аккаунту ограничен в связи с:
        </p>
        <blockquote className="mt-3 rounded-xl border border-signal/30 bg-signal/10 px-4 py-3 text-sm text-signal">
          {reason}
        </blockquote>

        <div className="mt-5 rounded-xl border border-[var(--c-border)] bg-[var(--c-soft)] px-4 py-4">
          <p className="text-[11px] uppercase tracking-wider text-[var(--c-faint)]">Срок блокировки</p>
          {permanent ? (
            <p className="mt-1 text-xl font-medium text-[var(--c-text)]">Бессрочно</p>
          ) : (
            <>
              <p className="mt-1 font-mono text-2xl tabular-nums tracking-tight text-[var(--c-text)]">
                {formatBanCountdown(msLeft)}
              </p>
              <p className="mt-1 text-[11px] text-[var(--c-faint)]">
                до {new Date(until!).toLocaleString('ru-RU')}
              </p>
            </>
          )}
        </div>

        {sent && (
          <p className="mt-4 rounded-lg border border-[color-mix(in_srgb,#43a047_40%,var(--c-border))] bg-[color-mix(in_srgb,#43a047_12%,var(--c-soft))] px-3 py-2 text-sm text-[color-mix(in_srgb,#2e7d32_45%,var(--c-text))]">
            Апелляция отправлена. Мы рассмотрим её в ближайшее время.
          </p>
        )}

        {appealOpen ? (
          <form onSubmit={onAppeal} className="mt-5 space-y-3">
            <label className="block text-[11px] uppercase tracking-wider text-[var(--c-faint)]">
              Текст апелляции
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                placeholder="Объясните ситуацию…"
                className="mt-1.5 w-full resize-y rounded-lg border border-[var(--c-border)] bg-[var(--c-input)] px-3 py-2 text-sm text-[var(--c-text)] outline-none focus:border-signal/50"
              />
            </label>
            {error && <p className="text-sm text-signal">{error}</p>}
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-signal px-4 py-2.5 text-sm font-medium text-white hover:brightness-110 disabled:opacity-50"
              >
                {busy ? 'Отправка…' : 'Отправить апелляцию'}
              </button>
              <button
                type="button"
                onClick={() => setAppealOpen(false)}
                className="rounded-lg border border-[var(--c-border)] px-4 py-2.5 text-sm text-[var(--c-muted)] hover:bg-[var(--c-hover)]"
              >
                Отмена
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => {
                setAppealOpen(true);
                setError(null);
              }}
              disabled={sent}
              className="flex-1 rounded-lg bg-signal px-4 py-2.5 text-sm font-medium text-white hover:brightness-110 disabled:opacity-40"
            >
              Отправить апелляцию
            </button>
            <Link
              to="/"
              className="flex flex-1 items-center justify-center rounded-lg border border-[var(--c-border)] px-4 py-2.5 text-sm text-[var(--c-muted)] hover:bg-[var(--c-hover)]"
            >
              На главную
            </Link>
          </div>
        )}

        <button
          type="button"
          onClick={() => void logout()}
          className="mt-4 w-full text-center text-xs text-[var(--c-faint)] hover:text-[var(--c-muted)]"
        >
          Выйти из аккаунта
        </button>
      </div>
    </div>
  );
}
