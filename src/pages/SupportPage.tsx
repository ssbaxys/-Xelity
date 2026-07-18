import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  addTicketMessage,
  createTicket,
  setTicketStatus,
  watchTicketMessages,
  watchUserTickets,
  type Ticket,
  type TicketCategory,
  type TicketMessage,
  type TicketPriority,
  type TicketStatus,
} from '../lib/rtdb';
import { messageRoleLabel } from '../lib/staff';
import AuthModal, { type AuthMode } from '../components/AuthModal';
import { setPageMeta } from '../lib/seo';

const STATUS_LABEL: Record<TicketStatus, string> = {
  open: 'Открыт',
  in_progress: 'В работе',
  resolved: 'Решён',
  closed: 'Закрыт',
};

const PRIORITY_LABEL: Record<TicketPriority, string> = {
  low: 'Низкий',
  normal: 'Обычный',
  high: 'Высокий',
  urgent: 'Срочный',
};

const CATEGORIES: { id: TicketCategory; label: string }[] = [
  { id: 'billing', label: 'Оплата / тариф' },
  { id: 'technical', label: 'Техническая' },
  { id: 'account', label: 'Аккаунт' },
  { id: 'other', label: 'Другое' },
];

function statusClass(status: TicketStatus) {
  if (status === 'open') return 'bg-amber-500/15 text-amber-700 dark:text-amber-300';
  if (status === 'in_progress') return 'bg-sky-500/15 text-sky-700';
  if (status === 'resolved') return 'bg-emerald-500/15 text-emerald-700';
  return 'bg-slate-500/15 text-slate';
}

export default function SupportPage() {
  useEffect(() => {
    setPageMeta({
      title: 'Поддержка',
      description: 'Служба поддержки Xelity: вопросы по оплате, аккаунту и работе чата.',
      path: '/support',
    });
  }, []);

  const { user, loading } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<TicketCategory>('technical');
  const [priority, setPriority] = useState<TicketPriority>('normal');
  const [body, setBody] = useState('');
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setTickets([]);
      return;
    }
    return watchUserTickets(user.uid, setTickets);
  }, [user]);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    return watchTicketMessages(activeId, setMessages);
  }, [activeId]);

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) {
      setAuthMode('login');
      setAuthOpen(true);
      return;
    }
    if (!subject.trim() || !body.trim()) {
      setError('Заполните тему и описание.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const id = await createTicket({
        uid: user.uid,
        email: (user.email || '').toLowerCase(),
        subject,
        category,
        priority,
        body,
        authorName: user.displayName || user.email || 'User',
      });
      setSubject('');
      setBody('');
      setPriority('normal');
      setActiveId(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка создания');
    } finally {
      setBusy(false);
    }
  };

  const onReply = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !activeId || !reply.trim()) return;
    setBusy(true);
    try {
      await addTicketMessage({
        ticketId: activeId,
        uid: user.uid,
        authorName: user.displayName || user.email || 'User',
        role: 'user',
        body: reply,
      });
      const t = tickets.find((x) => x.id === activeId);
      if (t?.status === 'resolved') {
        await setTicketStatus(activeId, 'open');
      }
      setReply('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка отправки');
    } finally {
      setBusy(false);
    }
  };

  const active = tickets.find((t) => t.id === activeId) ?? null;
  const canReply = active && active.status !== 'closed';

  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Link to="/" className="text-sm text-slate hover:text-ink">
          ← На главную
        </Link>
        <h1 className="mt-3 font-display text-3xl font-bold">Поддержка</h1>
        <p className="mt-2 text-sm text-slate">
          Создайте тикет — команда Xelity ответит в этой же переписке.
        </p>

        {!loading && !user && (
          <div className="mt-6 rounded-xl border border-line bg-elevated p-4 text-sm">
            Войдите, чтобы создать обращение.{' '}
            <button
              type="button"
              className="font-semibold text-signal"
              onClick={() => {
                setAuthMode('login');
                setAuthOpen(true);
              }}
            >
              Войти
            </button>
          </div>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-[300px_1fr]">
          <div className="space-y-4">
            <form onSubmit={onCreate} className="rounded-2xl border border-line bg-elevated p-4">
              <h2 className="text-sm font-semibold">Новый тикет</h2>
              <label className="mt-3 block text-xs text-slate">
                Тема
                <input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  maxLength={120}
                  className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-signal"
                />
              </label>
              <label className="mt-3 block text-xs text-slate">
                Категория
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as TicketCategory)}
                  className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-signal"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mt-3 block text-xs text-slate">
                Приоритет
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TicketPriority)}
                  className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-signal"
                >
                  {(Object.keys(PRIORITY_LABEL) as TicketPriority[]).map((p) => (
                    <option key={p} value={p}>
                      {PRIORITY_LABEL[p]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mt-3 block text-xs text-slate">
                Описание
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={4}
                  maxLength={4000}
                  className="mt-1 w-full resize-none rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-signal"
                />
              </label>
              {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={busy}
                className="mt-3 w-full rounded-lg bg-signal py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Создать
              </button>
            </form>

            <div className="rounded-2xl border border-line bg-elevated p-2">
              <p className="px-2 py-1 text-[11px] font-medium uppercase tracking-wider text-slate">
                Мои тикеты ({tickets.length})
              </p>
              {tickets.length === 0 ? (
                <p className="px-2 py-4 text-center text-xs text-slate">Пока пусто</p>
              ) : (
                <ul className="space-y-0.5">
                  {tickets.map((t) => (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => setActiveId(t.id)}
                        className={`w-full rounded-lg px-2 py-2 text-left text-sm transition hover:bg-mist ${
                          activeId === t.id ? 'bg-mist' : ''
                        }`}
                      >
                        <span className="block truncate font-medium">{t.subject}</span>
                        <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                          <span className={`rounded px-1.5 py-0.5 ${statusClass(t.status)}`}>
                            {STATUS_LABEL[t.status]}
                          </span>
                          {t.lastAuthorRole === 'staff' && t.status !== 'closed' && (
                            <span className="text-signal">есть ответ</span>
                          )}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="min-h-[420px] rounded-2xl border border-line bg-elevated p-4">
            {!active ? (
              <div className="flex h-full min-h-[380px] items-center justify-center text-sm text-slate">
                Выберите тикет или создайте новый
              </div>
            ) : (
              <div className="flex h-full min-h-[380px] flex-col">
                <div className="border-b border-line pb-3">
                  <h2 className="font-semibold">{active.subject}</h2>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate">
                    <span className={`rounded px-1.5 py-0.5 ${statusClass(active.status)}`}>
                      {STATUS_LABEL[active.status]}
                    </span>
                    <span>{PRIORITY_LABEL[active.priority || 'normal']}</span>
                    {active.assigneeName && <span>· отвечает {active.assigneeName}</span>}
                  </p>
                </div>
                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto py-4">
                  {messages.map((m) => {
                    const staffSide = m.role === 'admin' || m.role === 'staff';
                    return (
                      <div
                        key={m.id}
                        className={`max-w-[90%] rounded-xl px-3 py-2 text-sm ${
                          staffSide ? 'bg-signal/10 text-ink' : 'ml-auto bg-mist text-ink'
                        }`}
                      >
                        <p className="text-[10px] text-slate">
                          {staffSide
                            ? `${m.authorName} · ${messageRoleLabel(m.role, m.staffRole)}`
                            : 'вы'}
                          {' · '}
                          {new Date(m.createdAt).toLocaleString('ru-RU')}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
                      </div>
                    );
                  })}
                </div>
                {canReply ? (
                  <form onSubmit={onReply} className="flex gap-2 border-t border-line pt-3">
                    <input
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      placeholder={
                        active.status === 'resolved'
                          ? 'Написать снова (тикет откроется)…'
                          : 'Ваш ответ…'
                      }
                      className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-signal"
                    />
                    <button
                      type="submit"
                      disabled={busy || !reply.trim()}
                      className="rounded-lg bg-signal px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                    >
                      Отправить
                    </button>
                  </form>
                ) : (
                  <p className="border-t border-line pt-3 text-center text-xs text-slate">
                    Тикет закрыт. Создайте новый, если вопрос остался.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <AuthModal
        open={authOpen}
        mode={authMode}
        onClose={() => setAuthOpen(false)}
        onModeChange={setAuthMode}
      />
    </div>
  );
}
