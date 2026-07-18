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
        category: 'account',
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
    <div className="flex min-h-screen items-center justify-center bg-[#0a0707] px-4 py-10 text-[#f5ecec]">
      <div className="w-full max-w-lg rounded-2xl border border-[#2a1c1c] bg-[#140f0f] p-6 shadow-2xl sm:p-8">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-[#c62828]">
          Xelity
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Доступ ограничен</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#9a8585]">
          Доступ к аккаунту ограничен в связи с:
        </p>
        <blockquote className="mt-3 rounded-xl border border-[#5c2a2a]/60 bg-[#2a1212]/50 px-4 py-3 text-sm text-[#ff8a80]">
          {reason}
        </blockquote>

        <div className="mt-5 rounded-xl border border-[#2a1c1c] bg-[#0d0a0a] px-4 py-4">
          <p className="text-[11px] uppercase tracking-wider text-[#6e5555]">Срок блокировки</p>
          {permanent ? (
            <p className="mt-1 text-xl font-medium text-[#e8d5d5]">Бессрочно</p>
          ) : (
            <>
              <p className="mt-1 font-mono text-2xl tabular-nums tracking-tight text-[#e8d5d5]">
                {formatBanCountdown(msLeft)}
              </p>
              <p className="mt-1 text-[11px] text-[#6e5555]">
                до {new Date(until!).toLocaleString('ru-RU')}
              </p>
            </>
          )}
        </div>

        {sent && (
          <p className="mt-4 rounded-lg border border-[#2a3c2a] bg-[#121a12] px-3 py-2 text-sm text-[#81c784]">
            Апелляция отправлена. Мы рассмотрим её в ближайшее время.
          </p>
        )}

        {appealOpen ? (
          <form onSubmit={onAppeal} className="mt-5 space-y-3">
            <label className="block text-[11px] uppercase tracking-wider text-[#6e5555]">
              Текст апелляции
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={4}
                placeholder="Объясните ситуацию…"
                className="mt-1.5 w-full resize-y rounded-lg border border-[#2a1c1c] bg-[#0d0a0a] px-3 py-2 text-sm text-[#f5ecec] outline-none focus:border-[#c62828]/50"
              />
            </label>
            {error && <p className="text-sm text-[#e57373]">{error}</p>}
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-[#c62828] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#b71c1c] disabled:opacity-50"
              >
                {busy ? 'Отправка…' : 'Отправить апелляцию'}
              </button>
              <button
                type="button"
                onClick={() => setAppealOpen(false)}
                className="rounded-lg border border-[#2a1c1c] px-4 py-2.5 text-sm text-[#9a8585] hover:bg-white/5"
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
              className="flex-1 rounded-lg bg-[#c62828] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#b71c1c] disabled:opacity-40"
            >
              Отправить апелляцию
            </button>
            <Link
              to="/"
              className="flex flex-1 items-center justify-center rounded-lg border border-[#2a1c1c] px-4 py-2.5 text-sm text-[#9a8585] hover:bg-white/5"
            >
              На главную
            </Link>
          </div>
        )}

        <button
          type="button"
          onClick={() => void logout()}
          className="mt-4 w-full text-center text-xs text-[#6e5555] hover:text-[#9a8585]"
        >
          Выйти из аккаунта
        </button>
      </div>
    </div>
  );
}
