import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  addTicketMessage,
  claimTicket,
  setTicketPriority,
  setTicketStatus,
  unclaimTicket,
  watchTicketMessages,
  watchTickets,
  type Ticket,
  type TicketMessage,
  type TicketPriority,
  type TicketStatus,
} from '../../lib/rtdb';
import { messageRoleLabel } from '../../lib/staff';
import AdminSelect from './AdminSelect';
import AdminUserInvestigation from './AdminUserInvestigation';

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

const CATEGORY_LABEL: Record<string, string> = {
  billing: 'Оплата',
  technical: 'Техника',
  account: 'Аккаунт',
  other: 'Другое',
  appeal: 'Апелляция',
};

type Tab = 'thread' | 'investigate';
type StatusFilter = 'all' | 'needs_reply' | TicketStatus;

const STATUS_ORDER: Record<TicketStatus, number> = {
  open: 0,
  in_progress: 1,
  resolved: 2,
  closed: 3,
};

const PRIORITY_ORDER: Record<TicketPriority, number> = {
  urgent: 0,
  high: 1,
  normal: 2,
  low: 3,
};

export default function AdminTickets() {
  const { user, staffRole, can } = useAuth();
  const canInvestigate = can('tickets.investigate');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>('thread');
  const [filter, setFilter] = useState<StatusFilter>('needs_reply');
  const [search, setSearch] = useState('');

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

  const sorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...tickets]
      .filter((t) => {
        if (filter === 'needs_reply') {
          return (
            (t.status === 'open' || t.status === 'in_progress') &&
            t.lastAuthorRole !== 'staff'
          );
        }
        if (filter !== 'all' && t.status !== filter) return false;
        if (!q) return true;
        return (
          t.subject.toLowerCase().includes(q) ||
          t.email.toLowerCase().includes(q) ||
          t.uid.toLowerCase().includes(q) ||
          (t.assigneeName || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const pa = PRIORITY_ORDER[a.priority || 'normal'];
        const pb = PRIORITY_ORDER[b.priority || 'normal'];
        if (pa !== pb) return pa - pb;
        const sa = STATUS_ORDER[a.status];
        const sb = STATUS_ORDER[b.status];
        if (sa !== sb) return sa - sb;
        return (b.lastMessageAt || 0) - (a.lastMessageAt || 0);
      });
  }, [tickets, filter, search]);

  const active = tickets.find((t) => t.id === activeId) ?? null;
  const counts = useMemo(() => {
    const c = { all: tickets.length, needs_reply: 0, open: 0, in_progress: 0, resolved: 0, closed: 0 };
    for (const t of tickets) {
      c[t.status] += 1;
      if (
        (t.status === 'open' || t.status === 'in_progress') &&
        t.lastAuthorRole !== 'staff'
      ) {
        c.needs_reply += 1;
      }
    }
    return c;
  }, [tickets]);

  const onReply = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !activeId || !reply.trim()) return;
    setBusy(true);
    try {
      await addTicketMessage({
        ticketId: activeId,
        uid: user.uid,
        authorName: user.displayName || user.email || 'Staff',
        role: 'staff',
        staffRole,
        body: reply,
      });
      if (active && !active.assigneeUid) {
        await claimTicket({
          ticketId: activeId,
          assigneeUid: user.uid,
          assigneeName: user.displayName || user.email || 'Staff',
        });
      }
      setReply('');
    } finally {
      setBusy(false);
    }
  };

  const onClaim = async () => {
    if (!user || !active) return;
    setBusy(true);
    try {
      await claimTicket({
        ticketId: active.id,
        assigneeUid: user.uid,
        assigneeName: user.displayName || user.email || 'Staff',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="admin-page--fill flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Тикеты поддержки</h2>
          <p className="text-sm text-[var(--a-muted)]">
            Очередь обращений · ожидают ответа: {counts.needs_reply}
          </p>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск: тема, email, uid…"
          className="w-full max-w-xs rounded-lg border border-[var(--a-border)] bg-[var(--a-input)] px-3 py-2 text-sm outline-none sm:w-64"
        />
      </div>

      <div className="flex shrink-0 flex-wrap gap-1.5">
        {(
          [
            ['needs_reply', `Ждут ответа (${counts.needs_reply})`],
            ['all', `Все (${counts.all})`],
            ['open', `Открыты (${counts.open})`],
            ['in_progress', `В работе (${counts.in_progress})`],
            ['resolved', `Решены (${counts.resolved})`],
            ['closed', `Закрыты (${counts.closed})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`admin-chip ${filter === id ? 'is-active' : ''}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="admin-split is-tickets min-h-0 flex-1">
        <div
          className={`admin-panel admin-split-list admin-split-pane overflow-hidden p-2 ${
            activeId ? 'is-hidden-mobile' : ''
          }`}
        >
          <div className="min-h-0 flex-1 overflow-y-auto">
            {sorted.length === 0 ? (
              <p className="p-4 text-center text-sm text-[var(--a-faint)]">Нет тикетов</p>
            ) : (
              <ul className="space-y-0.5">
                {sorted.map((t) => {
                  const waiting =
                    (t.status === 'open' || t.status === 'in_progress') &&
                    t.lastAuthorRole !== 'staff';
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        onClick={() => setActiveId(t.id)}
                        className={`w-full rounded-lg px-2 py-2 text-left text-sm hover:bg-[var(--a-hover)] ${
                          activeId === t.id
                            ? 'bg-[var(--admin-accent-soft)]'
                            : ''
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          {waiting && (
                            <span
                              className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--admin-accent)]"
                              title="Ждёт ответа"
                            />
                          )}
                          <span className="block min-w-0 flex-1 truncate font-medium">
                            {t.subject}
                          </span>
                          {(t.priority === 'high' || t.priority === 'urgent') && (
                            <span className="shrink-0 text-[9px] uppercase tracking-wide text-[var(--a-accent-fg)]">
                              {t.priority === 'urgent' ? 'urgent' : 'high'}
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block truncate text-[11px] text-[var(--a-muted)]">
                          {STATUS_LABEL[t.status]} · {t.email}
                        </span>
                        {t.assigneeName && (
                          <span className="mt-0.5 block truncate text-[10px] text-[var(--a-faint)]">
                            → {t.assigneeName}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <div
          className={`admin-panel admin-split-detail admin-split-pane overflow-hidden ${
            !activeId ? 'is-hidden-mobile' : ''
          }`}
        >
          {!active ? (
            <div className="flex flex-1 items-center justify-center px-4 text-center text-sm text-[var(--a-faint)]">
              Выберите тикет
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col">
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--a-border)] px-3 py-3 sm:px-4">
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => setActiveId(null)}
                    className="mb-1 text-[12px] text-[var(--a-muted)] hover:text-[var(--a-text)] lg:hidden"
                  >
                    ← К списку
                  </button>
                  <h3 className="truncate font-semibold">{active.subject}</h3>
                  <p className="break-words text-xs text-[var(--a-muted)]">
                    {active.email} · {CATEGORY_LABEL[active.category] || active.category}
                    {can('users.view') && (
                      <>
                        {' · uid '}
                        <Link
                          to={`/admin/users/${active.uid}`}
                          className="text-[var(--admin-accent)] hover:underline"
                        >
                          {active.uid.slice(0, 8)}…
                        </Link>
                      </>
                    )}
                  </p>
                  {active.assigneeName ? (
                    <p className="mt-1 text-[11px] text-[var(--a-faint)]">
                      Взял: {active.assigneeName}{' '}
                      {active.assigneeUid === user?.uid && (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => void unclaimTicket(active.id)}
                          className="ml-1 underline hover:text-[var(--a-text)]"
                        >
                          отпустить
                        </button>
                      )}
                    </p>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void onClaim()}
                      className="mt-1 text-[11px] text-[var(--admin-accent)] underline"
                    >
                      Взять в работу
                    </button>
                  )}
                </div>
                <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                  <AdminSelect
                    className="min-w-[7rem] flex-1 sm:flex-none"
                    value={active.priority || 'normal'}
                    options={(Object.keys(PRIORITY_LABEL) as TicketPriority[]).map((p) => ({
                      value: p,
                      label: PRIORITY_LABEL[p],
                    }))}
                    onChange={(p) => void setTicketPriority(active.id, p)}
                  />
                  <AdminSelect
                    className="min-w-[7rem] flex-1 sm:flex-none"
                    value={active.status}
                    options={(Object.keys(STATUS_LABEL) as TicketStatus[]).map((s) => ({
                      value: s,
                      label: STATUS_LABEL[s],
                    }))}
                    onChange={(s) => void setTicketStatus(active.id, s)}
                  />
                </div>
              </div>

              <div className="flex gap-1 border-b border-[var(--a-border)] px-3 pt-2">
                <button
                  type="button"
                  onClick={() => setTab('thread')}
                  className={`admin-tab ${tab === 'thread' ? 'is-active' : ''}`}
                >
                  Переписка
                </button>
                {canInvestigate && (
                  <button
                    type="button"
                    onClick={() => setTab('investigate')}
                    className={`admin-tab ${tab === 'investigate' ? 'is-active' : ''}`}
                  >
                    Разбор
                  </button>
                )}
              </div>

              {tab === 'thread' || !canInvestigate ? (
                <>
                  <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
                    {messages.map((m) => {
                      const staffSide = m.role === 'admin' || m.role === 'staff';
                      return (
                        <div
                          key={m.id}
                          className={`max-w-[90%] rounded-xl px-3 py-2 text-sm ${
                            staffSide
                              ? 'bg-[var(--admin-accent-soft)]'
                              : 'ml-auto bg-[var(--a-chip)]'
                          }`}
                        >
                          <p className="text-[10px] text-[var(--a-muted)]">
                            {m.authorName} · {messageRoleLabel(m.role, m.staffRole)}
                            {' · '}
                            {new Date(m.createdAt).toLocaleString('ru-RU')}
                          </p>
                          <p className="mt-1 whitespace-pre-wrap">{m.body}</p>
                        </div>
                      );
                    })}
                    {!messages.length && (
                      <p className="text-center text-sm text-[var(--a-faint)]">Пока нет сообщений</p>
                    )}
                  </div>
                  {active.status !== 'closed' && (
                    <form
                      onSubmit={onReply}
                      className="flex flex-col gap-2 border-t border-[var(--a-border)] px-3 py-3 sm:px-4"
                    >
                      <input
                        value={reply}
                        onChange={(e) => setReply(e.target.value)}
                        placeholder="Ответ поддержки…"
                        className="min-w-0 w-full rounded-lg border border-[var(--a-border)] bg-[var(--a-input)] px-3 py-2 text-sm outline-none"
                      />
                      <div className="flex flex-col gap-1.5 xs:flex-row sm:flex-row">
                        <button
                          type="button"
                          disabled={busy || !reply.trim()}
                          onClick={() => {
                            void (async () => {
                              if (!user || !activeId || !reply.trim()) return;
                              setBusy(true);
                              try {
                                await addTicketMessage({
                                  ticketId: activeId,
                                  uid: user.uid,
                                  authorName: user.displayName || user.email || 'Staff',
                                  role: 'staff',
                                  staffRole,
                                  body: reply,
                                  keepStatus: true,
                                });
                                await setTicketStatus(activeId, 'resolved');
                                setReply('');
                              } finally {
                                setBusy(false);
                              }
                            })();
                          }}
                          className="w-full rounded-lg border border-[var(--a-border)] px-3 py-2 text-sm text-[var(--a-muted)] hover:bg-[var(--a-hover)] disabled:opacity-40 sm:w-auto"
                        >
                          Ответить и решить
                        </button>
                        <button
                          type="submit"
                          disabled={busy || !reply.trim()}
                          className="w-full rounded-lg bg-[var(--admin-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 sm:w-auto"
                        >
                          Ответить
                        </button>
                      </div>
                    </form>
                  )}
                </>
              ) : (
                <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-4">
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
