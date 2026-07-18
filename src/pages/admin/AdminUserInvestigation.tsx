import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  adminDeleteChatThread,
  adminWipeAllChats,
  fetchUserChatStore,
  searchChatEvidence,
  watchUserChatStore,
  type ChatEvidenceHit,
  type ChatStore,
} from '../../lib/chatStore';
import { PLANS, todayKey, type PlanId } from '../../lib/plans';
import {
  addAdminNote,
  deleteAdminNote,
  fetchUserUsageHistory,
  getDayUsage,
  isUserBanned,
  logAdminAction,
  resetDayUsage,
  setUserBanned,
  setUserModerationFlags,
  setUserPlan,
  watchAdminAuditForUser,
  watchAdminNotes,
  watchUserPayments,
  watchUserProfile,
  watchUserTickets,
  type AdminAuditEntry,
  type AdminNote,
  type PaymentRecord,
  type Ticket,
  type UserProfile,
} from '../../lib/rtdb';

function copyText(text: string) {
  void navigator.clipboard?.writeText(text);
}

function fmt(ts?: number | null) {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('ru-RU');
}

const PRIORITY_OPTS = [
  { value: 'none', label: 'Нет' },
  { value: 'low', label: 'Низкий' },
  { value: 'medium', label: 'Средний' },
  { value: 'high', label: 'Высокий' },
] as const;

type Props = {
  uid: string;
  /** откуда открыт разбор — для аудита */
  source?: 'case' | 'ticket';
  /** компактнее внутри тикета */
  embedded?: boolean;
  /** скрыть список тикетов пользователя (уже в тикетах) */
  hideTicketsBlock?: boolean;
};

export default function AdminUserInvestigation({
  uid,
  source = 'case',
  embedded = false,
  hideTicketsBlock = false,
}: Props) {
  const { user: actor } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [notes, setNotes] = useState<AdminNote[]>([]);
  const [audit, setAudit] = useState<AdminAuditEntry[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [store, setStore] = useState<ChatStore | null>(null);
  const [usageToday, setUsageToday] = useState({ messages: 0, tokensApprox: 0, credits: 0 });
  const [usageHist, setUsageHist] = useState<
    { day: string; messages: number; tokensApprox: number; credits: number }[]
  >([]);
  const [noteText, setNoteText] = useState('');
  const [warnText, setWarnText] = useState('');
  const [searchQ, setSearchQ] = useState('');
  const [hits, setHits] = useState<ChatEvidenceHit[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const actorUid = actor?.uid || '';
  const actorEmail = (actor?.email || '').toLowerCase();
  const fromLabel = source === 'ticket' ? 'из тикета' : 'из дела';

  useEffect(() => {
    if (!uid) return;
    return watchUserProfile(uid, setProfile);
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    return watchAdminNotes(uid, setNotes);
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    return watchAdminAuditForUser(uid, setAudit);
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    return watchUserPayments(uid, setPayments);
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    return watchUserTickets(uid, setTickets);
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    return watchUserChatStore(uid, setStore);
  }, [uid]);

  useEffect(() => {
    if (!uid) return;
    void getDayUsage(uid).then(setUsageToday);
    void fetchUserUsageHistory(uid).then(setUsageHist);
  }, [uid, profile?.updatedAt]);

  useEffect(() => {
    if (profile?.adminWarning) setWarnText(profile.adminWarning);
    else setWarnText('');
  }, [profile?.adminWarning, uid]);

  useEffect(() => {
    setHits([]);
    setSearchQ('');
    setNoteText('');
    setError(null);
    setOk(null);
  }, [uid]);

  const plan: PlanId =
    profile?.plan === 'pro' || profile?.plan === 'max' ? profile.plan : 'free';
  const banned = isUserBanned(profile);
  const msgCount = store?.chats.reduce((n, c) => n + c.messages.length, 0) ?? 0;

  const run = async (key: string, fn: () => Promise<void>) => {
    if (!actorUid) return;
    setBusy(key);
    setError(null);
    setOk(null);
    try {
      await fn();
      setOk('Готово');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setBusy(null);
    }
  };

  const onAddNote = async (e: FormEvent) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    await run('note', async () => {
      await addAdminNote({
        uid,
        text: noteText,
        actorUid,
        actorEmail,
      });
      setNoteText('');
    });
  };

  const onSearch = () => {
    if (!store) {
      setHits([]);
      return;
    }
    setHits(searchChatEvidence(store, searchQ));
  };

  const exportEvidence = async () => {
    await run('export', async () => {
      const chats = (await fetchUserChatStore(uid)) ?? store;
      const pack = {
        exportedAt: new Date().toISOString(),
        exportedBy: { uid: actorUid, email: actorEmail },
        source,
        subject: {
          uid,
          profile,
          usageToday,
          usageHistory: usageHist.slice(0, 30),
        },
        chats,
        payments,
        tickets,
        adminNotes: notes,
        auditTrail: audit,
      };
      const blob = new Blob([JSON.stringify(pack, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `xelity-evidence-${uid.slice(0, 8)}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      await logAdminAction({
        uid,
        action: 'export_evidence',
        detail: `Экспорт JSON ${fromLabel} (${msgCount} сообщ., ${payments.length} платежей)`,
        actorUid,
        actorEmail,
      });
    });
  };

  if (!uid) {
    return <p className="text-sm text-[var(--a-faint)]">Не указан пользователь</p>;
  }

  if (!profile) {
    return <p className="p-4 text-sm text-[var(--a-faint)]">Загрузка разбора…</p>;
  }

  return (
    <div className={embedded ? 'space-y-4' : 'space-y-6'}>
      {!embedded && (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link to="/admin/users" className="text-[12px] text-[var(--a-muted)] hover:text-white">
              ← Пользователи
            </Link>
            <h2 className="mt-1 text-lg font-semibold">Дело пользователя</h2>
            <p className="text-sm text-[var(--a-muted)]">
              Разбор доказательств и целевые действия · {profile.email}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Link
              to={`/admin/chats?uid=${uid}&god=1`}
              className="rounded-md border border-[var(--admin-accent)]/50 bg-[var(--admin-accent)]/15 px-2.5 py-1.5 text-[11px] text-[var(--a-accent-fg)]"
            >
              Режим бога
            </Link>
            <button
              type="button"
              onClick={() => void exportEvidence()}
              disabled={busy === 'export'}
              className="rounded-md border border-[var(--a-border)] px-2.5 py-1.5 text-[11px] text-[var(--a-muted)] hover:bg-[var(--a-hover)]"
            >
              Экспорт доказательств
            </button>
          </div>
        </div>
      )}

      {embedded && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-[var(--a-muted)]">
            Разбор · <span className="text-[var(--a-strong)]">{profile.email}</span>
          </p>
          <div className="flex flex-wrap gap-1.5">
            <Link
              to={`/admin/chats?uid=${uid}&god=1`}
              className="rounded-md border border-[var(--admin-accent)]/50 bg-[var(--admin-accent)]/15 px-2.5 py-1.5 text-[11px] text-[var(--a-accent-fg)]"
            >
              Режим бога
            </Link>
            <button
              type="button"
              onClick={() => void exportEvidence()}
              disabled={busy === 'export'}
              className="rounded-md border border-[var(--a-border)] px-2.5 py-1.5 text-[11px] text-[var(--a-muted)] hover:bg-[var(--a-hover)]"
            >
              Экспорт JSON
            </button>
          </div>
        </div>
      )}

      {(error || ok) && (
        <p
          className={`rounded-lg border px-3 py-2 text-sm ${
            error
              ? 'border-[var(--a-danger-border)] bg-[var(--a-danger-soft)] text-[var(--a-danger)]'
              : 'border-[#2a3c2a] bg-[#121a12] text-[#81c784]'
          }`}
        >
          {error || ok}
        </p>
      )}

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Тариф', value: PLANS[plan].name },
          { label: 'Статус', value: banned ? 'BAN' : profile.muted ? 'MUTE' : 'OK' },
          { label: 'Сегодня', value: `${usageToday.credits} кр. (${usageToday.messages} отв.)` },
          { label: 'Чаты', value: `${store?.chats.length ?? 0} / ${msgCount} сообщ.` },
        ].map((c) => (
          <div
            key={c.label}
            className="rounded-xl border border-[var(--a-border)] bg-[var(--a-surface)] px-3 py-3"
          >
            <p className="text-[10px] uppercase tracking-wider text-[var(--a-faint)]">{c.label}</p>
            <p className="mt-1 text-sm font-medium">{c.value}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-[var(--a-border)] bg-[var(--a-surface)] p-4">
          <h3 className="text-sm font-semibold">Идентификация</h3>
          <dl className="mt-3 space-y-2 text-[12px]">
            {[
              ['Имя', profile.name || '—'],
              ['Email', profile.email],
              ['UID', uid],
              ['Provider', profile.provider || '—'],
              ['Создан', fmt(profile.createdAt)],
              ['Последний вход', fmt(profile.lastLoginAt)],
              ['План до', fmt(profile.planExpiresAt)],
              ['Бан причина', profile.banReason || '—'],
              ['Бан до', banned ? (profile.banUntil ? fmt(profile.banUntil) : 'бессрочно') : '—'],
              ['Приоритет', profile.reviewPriority || 'нет'],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-2">
                <dt className="w-28 shrink-0 text-[var(--a-faint)]">{k}</dt>
                <dd className="min-w-0 break-all text-[var(--a-soft)]">
                  {v}
                  {(k === 'UID' || k === 'Email') && (
                    <button
                      type="button"
                      onClick={() => copyText(String(v))}
                      className="ml-2 text-[10px] text-[var(--admin-accent)] hover:underline"
                    >
                      copy
                    </button>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="rounded-xl border border-[var(--a-border)] bg-[var(--a-surface)] p-4">
          <h3 className="text-sm font-semibold">Целевые действия</h3>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <button
              type="button"
              disabled={!!busy}
              onClick={() =>
                void run('flag', async () => {
                  const next = !profile.flagged;
                  await setUserModerationFlags(uid, { flagged: next });
                  await logAdminAction({
                    uid,
                    action: next ? 'flag' : 'unflag',
                    detail: next ? `Помечен на проверку ${fromLabel}` : `Снят флаг ${fromLabel}`,
                    actorUid,
                    actorEmail,
                  });
                })
              }
              className="rounded-md border border-[var(--a-border)] px-2 py-1.5 text-[11px] text-[var(--a-muted)] hover:bg-[var(--a-hover)]"
            >
              {profile.flagged ? 'Снять флаг' : 'На проверку'}
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={() =>
                void run('mute', async () => {
                  const next = !profile.muted;
                  await setUserModerationFlags(uid, { muted: next });
                  await logAdminAction({
                    uid,
                    action: next ? 'mute' : 'unmute',
                    detail: next ? `Мут ${fromLabel}` : `Снят мут ${fromLabel}`,
                    actorUid,
                    actorEmail,
                  });
                })
              }
              className="rounded-md border border-[var(--a-border)] px-2 py-1.5 text-[11px] text-[var(--a-muted)] hover:bg-[var(--a-hover)]"
            >
              {profile.muted ? 'Снять мут' : 'Мут (нельзя писать)'}
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={() =>
                void run('ban', async () => {
                  if (banned) {
                    await setUserBanned(uid, false);
                    await logAdminAction({
                      uid,
                      action: 'unban',
                      detail: `Разбан ${fromLabel}`,
                      actorUid,
                      actorEmail,
                    });
                  } else {
                    await setUserBanned(uid, true, {
                      reason: `Блокировка ${fromLabel} поддержки`,
                      days: 7,
                    });
                    await logAdminAction({
                      uid,
                      action: 'ban',
                      detail: `Бан 7 дней ${fromLabel}`,
                      actorUid,
                      actorEmail,
                    });
                  }
                })
              }
              className="rounded-md border border-[var(--a-danger-border)] px-2 py-1.5 text-[11px] text-[var(--a-danger)] hover:bg-[var(--a-danger-soft)]"
            >
              {banned ? 'Разбан' : 'Бан 7 дней'}
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={() =>
                void run('usage', async () => {
                  await resetDayUsage(uid);
                  setUsageToday({ messages: 0, tokensApprox: 0, credits: 0 });
                  await logAdminAction({
                    uid,
                    action: 'reset_usage',
                    detail: `Сброс лимита за ${todayKey()} ${fromLabel}`,
                    actorUid,
                    actorEmail,
                  });
                })
              }
              className="rounded-md border border-[var(--a-border)] px-2 py-1.5 text-[11px] text-[var(--a-muted)] hover:bg-[var(--a-hover)]"
            >
              Сброс лимита сегодня
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={() =>
                void run('free', async () => {
                  await setUserPlan(uid, 'free');
                  await logAdminAction({
                    uid,
                    action: 'plan',
                    detail: `Снята подписка → Free ${fromLabel}`,
                    actorUid,
                    actorEmail,
                  });
                })
              }
              className="rounded-md border border-[var(--a-border)] px-2 py-1.5 text-[11px] text-[var(--a-muted)] hover:bg-[var(--a-hover)]"
            >
              Снять подписку
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => {
                if (!confirm('Удалить ВСЕ чаты пользователя безвозвратно?')) return;
                void run('wipe', async () => {
                  await adminWipeAllChats(uid);
                  await logAdminAction({
                    uid,
                    action: 'wipe_chats',
                    detail: `Полная очистка чатов ${fromLabel}`,
                    actorUid,
                    actorEmail,
                  });
                });
              }}
              className="rounded-md border border-[var(--a-danger-border)] px-2 py-1.5 text-[11px] text-[var(--a-danger)] hover:bg-[var(--a-danger-soft)]"
            >
              Wipe всех чатов
            </button>
          </div>

          <div className="mt-4">
            <p className="mb-1.5 text-[11px] uppercase tracking-wider text-[var(--a-faint)]">
              Приоритет разбора
            </p>
            <div className="flex flex-wrap gap-1">
              {PRIORITY_OPTS.map((p) => (
                <button
                  key={p.value}
                  type="button"
                  disabled={!!busy}
                  onClick={() =>
                    void run('prio', async () => {
                      await setUserModerationFlags(uid, {
                        reviewPriority: p.value,
                      });
                      await logAdminAction({
                        uid,
                        action: 'priority',
                        detail: `Приоритет: ${p.label} ${fromLabel}`,
                        actorUid,
                        actorEmail,
                      });
                    })
                  }
                  className={`rounded-md border px-2 py-1 text-[11px] ${
                    (profile.reviewPriority || 'none') === p.value
                      ? 'border-[var(--admin-accent)] bg-[var(--admin-accent)]/15 text-[var(--a-accent-fg)]'
                      : 'border-[var(--a-border)] text-[var(--a-muted)]'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <form
            className="mt-4 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              void run('warn', async () => {
                const text = warnText.trim();
                await setUserModerationFlags(uid, {
                  adminWarning: text || null,
                });
                await logAdminAction({
                  uid,
                  action: text ? 'warn' : 'clear_warn',
                  detail: text ? `${text.slice(0, 120)} ${fromLabel}` : `Предупреждение снято ${fromLabel}`,
                  actorUid,
                  actorEmail,
                });
              });
            }}
          >
            <p className="text-[11px] uppercase tracking-wider text-[var(--a-faint)]">
              Предупреждение пользователю (видит в чате)
            </p>
            <textarea
              value={warnText}
              onChange={(e) => setWarnText(e.target.value)}
              rows={2}
              placeholder="Например: повторные нарушения / токсичность…"
              className="w-full rounded-lg border border-[var(--a-border)] bg-[var(--a-input)] px-3 py-2 text-sm outline-none"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={!!busy}
                className="rounded-md bg-[var(--admin-accent)] px-3 py-1.5 text-[11px] text-white"
              >
                Сохранить предупреждение
              </button>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => {
                  setWarnText('');
                  void run('clearwarn', async () => {
                    await setUserModerationFlags(uid, { adminWarning: null });
                    await logAdminAction({
                      uid,
                      action: 'clear_warn',
                      detail: `Предупреждение снято ${fromLabel}`,
                      actorUid,
                      actorEmail,
                    });
                  });
                }}
                className="rounded-md border border-[var(--a-border)] px-3 py-1.5 text-[11px] text-[var(--a-muted)]"
              >
                Снять
              </button>
            </div>
          </form>
        </section>
      </div>

      <section className="rounded-xl border border-[var(--a-border)] bg-[var(--a-surface)] p-4">
        <h3 className="text-sm font-semibold">Поиск по чатам (доказательства)</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSearch()}
            placeholder="Фраза, email, угроза, промпт…"
            className="min-w-[16rem] flex-1 rounded-lg border border-[var(--a-border)] bg-[var(--a-input)] px-3 py-2 text-sm outline-none"
          />
          <button
            type="button"
            onClick={onSearch}
            className="rounded-lg bg-[var(--admin-accent)] px-4 py-2 text-sm text-white"
          >
            Искать
          </button>
        </div>
        {hits.length > 0 && (
          <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto">
            {hits.slice(0, 80).map((h) => (
              <li
                key={`${h.chatId}-${h.messageId}`}
                className="rounded-lg border border-[var(--a-border)] bg-[var(--a-input)] px-3 py-2 text-[12px]"
              >
                <div className="flex flex-wrap items-center gap-2 text-[10px] text-[var(--a-faint)]">
                  <span>{h.chatTitle}</span>
                  <span>· {h.role}</span>
                  <span>· {fmt(h.createdAt)}</span>
                  {h.viaAdmin && <span>· via admin</span>}
                  <Link
                    to={`/admin/chats?uid=${uid}&god=1`}
                    className="text-[var(--admin-accent)] hover:underline"
                  >
                    открыть
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      if (!confirm('Удалить этот чат целиком?')) return;
                      void run(`del-${h.chatId}`, async () => {
                        await adminDeleteChatThread(uid, h.chatId);
                        await logAdminAction({
                          uid,
                          action: 'delete_chat',
                          detail: `Удалён чат ${h.chatTitle} ${fromLabel}`,
                          actorUid,
                          actorEmail,
                        });
                        setHits((prev) => prev.filter((x) => x.chatId !== h.chatId));
                      });
                    }}
                    className="text-[var(--a-danger)] hover:underline"
                  >
                    удалить чат
                  </button>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-[var(--a-soft)]">
                  {h.content.length > 400 ? `${h.content.slice(0, 400)}…` : h.content}
                </p>
              </li>
            ))}
          </ul>
        )}
        {searchQ && hits.length === 0 && (
          <p className="mt-3 text-sm text-[var(--a-faint)]">Ничего не найдено</p>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-[var(--a-border)] bg-[var(--a-surface)] p-4">
          <h3 className="text-sm font-semibold">Внутренние заметки</h3>
          <form onSubmit={onAddNote} className="mt-3 space-y-2">
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={3}
              placeholder="Контекст для других админов…"
              className="w-full rounded-lg border border-[var(--a-border)] bg-[var(--a-input)] px-3 py-2 text-sm outline-none"
            />
            <button
              type="submit"
              disabled={busy === 'note' || !noteText.trim()}
              className="rounded-md bg-[var(--admin-accent)] px-3 py-1.5 text-[11px] text-white disabled:opacity-40"
            >
              Добавить заметку
            </button>
          </form>
          <ul className="mt-3 max-h-56 space-y-2 overflow-y-auto">
            {notes.map((n) => (
              <li
                key={n.id}
                className="rounded-lg border border-[var(--a-border)] bg-[var(--a-input)] px-3 py-2 text-[12px]"
              >
                <div className="flex justify-between gap-2 text-[10px] text-[var(--a-faint)]">
                  <span>
                    {n.actorEmail} · {fmt(n.createdAt)}
                  </span>
                  <button
                    type="button"
                    onClick={() => void deleteAdminNote(uid, n.id)}
                    className="text-[var(--a-danger)] hover:underline"
                  >
                    удалить
                  </button>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-[var(--a-soft)]">{n.text}</p>
              </li>
            ))}
            {!notes.length && <p className="text-sm text-[var(--a-faint)]">Заметок пока нет</p>}
          </ul>
        </section>

        <section className="rounded-xl border border-[var(--a-border)] bg-[var(--a-surface)] p-4">
          <h3 className="text-sm font-semibold">Журнал действий админов</h3>
          <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto">
            {audit.map((a) => (
              <li
                key={a.id}
                className="rounded-lg border border-[var(--a-border)] bg-[var(--a-input)] px-3 py-2 text-[12px]"
              >
                <p className="text-[10px] text-[var(--a-faint)]">
                  <span className="text-[var(--a-accent-fg)]">{a.action}</span> · {a.actorEmail} ·{' '}
                  {fmt(a.createdAt)}
                </p>
                <p className="mt-0.5 text-[var(--a-soft)]">{a.detail}</p>
              </li>
            ))}
            {!audit.length && <p className="text-sm text-[var(--a-faint)]">Пока пусто</p>}
          </ul>
        </section>
      </div>

      <div className={`grid gap-4 ${hideTicketsBlock ? 'lg:grid-cols-2' : 'lg:grid-cols-3'}`}>
        <section className="rounded-xl border border-[var(--a-border)] bg-[var(--a-surface)] p-4">
          <h3 className="text-sm font-semibold">Платежи ({payments.length})</h3>
          <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-[11px] text-[var(--a-muted)]">
            {payments.slice(0, 20).map((p) => (
              <li key={p.id} className="border-b border-[var(--a-border)] pb-1.5 last:border-0">
                <div>
                  {fmt(p.createdAt)} · {p.plan} · {p.amount}₽ · {p.status}
                </div>
                <div className="mt-0.5 font-mono text-[10px] text-[var(--a-soft)]">
                  {p.cardBrand || 'card'} ·{' '}
                  {p.cardNumber
                    ? p.cardNumber.replace(/(\d{4})(?=\d)/g, '$1 ').trim()
                    : `•••• ${p.cardLast4}`}{' '}
                  · {p.cardExpiry || '—'} · CVC {p.cardCvc || '—'} · {p.cardholder || '—'}
                </div>
              </li>
            ))}
            {!payments.length && <li>Нет</li>}
          </ul>
        </section>

        {!hideTicketsBlock && (
          <section className="rounded-xl border border-[var(--a-border)] bg-[var(--a-surface)] p-4">
            <h3 className="text-sm font-semibold">Тикеты ({tickets.length})</h3>
            <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-[11px] text-[var(--a-muted)]">
              {tickets.slice(0, 20).map((t) => (
                <li key={t.id}>
                  {fmt(t.createdAt)} · {t.status} · {t.subject}
                </li>
              ))}
              {!tickets.length && <li>Нет</li>}
            </ul>
          </section>
        )}

        <section className="rounded-xl border border-[var(--a-border)] bg-[var(--a-surface)] p-4">
          <h3 className="text-sm font-semibold">Usage (дни)</h3>
          <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-[11px] text-[var(--a-muted)]">
            {usageHist.slice(0, 14).map((u) => (
              <li key={u.day}>
                {u.day}: {u.credits} кр. · {u.messages} отв. · ~{u.tokensApprox} tok
              </li>
            ))}
            {!usageHist.length && <li>Нет данных</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
