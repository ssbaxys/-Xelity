import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  addTicketMessage,
  setTicketStatus,
  watchTicketMessages,
  watchTickets,
  type Ticket,
  type TicketMessage,
  type TicketStatus,
} from '../../lib/rtdb';
import AdminSelect from './AdminSelect';
import AdminUserInvestigation from './AdminUserInvestigation';

const STATUS_LABEL: Record<TicketStatus, string> = {
  open: 'Открыт',
  in_progress: 'В работе',
  resolved: 'Решён',
  closed: 'Закрыт',
};

type Tab = 'thread' | 'investigate';

export default function AdminTickets() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>('thread');

  useEffect(() => watchTickets(setTickets), []);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    return watchTicketMessages(activeId, setMessages);
  }, [activeId]);

  useEffect(() => {
    setTab('thread');
    setReply('');
  }, [activeId]);

  const active = tickets.find((t) => t.id === activeId) ?? null;

  const onReply = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !activeId || !reply.trim()) return;
    setBusy(true);
    try {
      await addTicketMessage({
        ticketId: activeId,
        uid: user.uid,
        authorName: user.displayName || 'Admin',
        role: 'admin',
        body: reply,
      });
      setReply('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Тикеты поддержки</h2>
        <p className="text-sm text-[#9a8585]">
          Переписка и полный разбор пользователя прямо в тикете
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <div className="admin-panel max-h-[78vh] overflow-y-auto p-2">
          {tickets.length === 0 ? (
            <p className="p-4 text-center text-sm text-[#6e5555]">Нет тикетов</p>
          ) : (
            <ul className="space-y-0.5">
              {tickets.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(t.id)}
                    className={`w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-white/5 ${
                      activeId === t.id ? 'bg-[#c62828]/15' : ''
                    }`}
                  >
                    <span className="block truncate font-medium">{t.subject}</span>
                    <span className="text-[11px] text-[#9a8585]">
                      {STATUS_LABEL[t.status]} · {t.email}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="admin-panel min-h-[520px]">
          {!active ? (
            <div className="flex h-full min-h-[480px] items-center justify-center text-sm text-[#6e5555]">
              Выберите тикет
            </div>
          ) : (
            <div className="flex h-full min-h-[520px] flex-col">
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[#2a1c1c] px-4 py-3">
                <div className="min-w-0">
                  <h3 className="font-semibold">{active.subject}</h3>
                  <p className="text-xs text-[#9a8585]">
                    {active.email} · {active.category} · uid{' '}
                    <Link
                      to={`/admin/users/${active.uid}`}
                      className="text-[#c62828] hover:underline"
                    >
                      {active.uid.slice(0, 8)}…
                    </Link>
                  </p>
                </div>
                <AdminSelect
                  value={active.status}
                  options={(Object.keys(STATUS_LABEL) as TicketStatus[]).map((s) => ({
                    value: s,
                    label: STATUS_LABEL[s],
                  }))}
                  onChange={(s) => void setTicketStatus(active.id, s)}
                />
              </div>

              <div className="flex gap-1 border-b border-[#2a1c1c] px-3 pt-2">
                {(
                  [
                    ['thread', 'Переписка'],
                    ['investigate', 'Разбор'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTab(id)}
                    className={`admin-tab ${tab === id ? 'is-active' : ''}`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {tab === 'thread' ? (
                <>
                  <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
                    {messages.map((m) => (
                      <div
                        key={m.id}
                        className={`max-w-[90%] rounded-xl px-3 py-2 text-sm ${
                          m.role === 'admin' ? 'bg-[#c62828]/15' : 'ml-auto bg-[#221616]'
                        }`}
                      >
                        <p className="text-[10px] text-[#9a8585]">
                          {m.authorName} · {m.role}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
                      </div>
                    ))}
                    {!messages.length && (
                      <p className="text-center text-sm text-[#6e5555]">Пока нет сообщений</p>
                    )}
                  </div>
                  <form
                    onSubmit={onReply}
                    className="flex gap-2 border-t border-[#2a1c1c] px-4 py-3"
                  >
                    <input
                      value={reply}
                      onChange={(e) => setReply(e.target.value)}
                      placeholder="Ответ поддержки…"
                      className="min-w-0 flex-1 rounded-lg border border-[#2a1c1c] bg-[#0d0a0a] px-3 py-2 text-sm outline-none"
                    />
                    <button
                      type="submit"
                      disabled={busy || !reply.trim()}
                      className="rounded-lg bg-[#c62828] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                    >
                      Ответить
                    </button>
                  </form>
                </>
              ) : (
                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                  <AdminUserInvestigation
                    uid={active.uid}
                    source="ticket"
                    embedded
                    hideTicketsBlock
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
