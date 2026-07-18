import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import PlanCountdown from '../../components/PlanCountdown';
import { ADMIN_DURATIONS, PLANS, todayKey, type PlanId } from '../../lib/plans';
import {
  getDayUsage,
  isUserBanned,
  setUserBanned,
  setUserIsAdmin,
  setUserPlan,
  watchAllUsers,
  type UserProfile,
} from '../../lib/rtdb';

type SubModal = {
  user: UserProfile;
  plan: 'pro' | 'max';
  /** preset days, custom days, or absolute date */
  mode: 'preset' | 'custom' | 'date';
  presetDays: number;
  customDays: string;
  expiresLocal: string;
  applyMode: 'replace' | 'extend';
};

type BanModal = {
  user: UserProfile;
  reason: string;
  duration: '1h' | '1d' | '7d' | '30d' | 'permanent' | 'custom';
  customDays: string;
  customHours: string;
};

function toLocalInput(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function openSubModal(user: UserProfile): SubModal {
  const plan = user.plan === 'max' ? 'max' : 'pro';
  const hasActive =
    (user.plan === 'pro' || user.plan === 'max') &&
    typeof user.planExpiresAt === 'number' &&
    user.planExpiresAt > Date.now();
  return {
    user,
    plan,
    mode: 'preset',
    presetDays: hasActive ? 30 : 30,
    customDays: '14',
    expiresLocal: toLocalInput(
      hasActive && user.planExpiresAt
        ? user.planExpiresAt
        : Date.now() + 30 * 24 * 60 * 60 * 1000,
    ),
    /** Если подписка уже есть — по умолчанию продлить к текущему сроку */
    applyMode: hasActive ? 'extend' : 'replace',
  };
}

export default function AdminUsers() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [usageMap, setUsageMap] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [modal, setModal] = useState<SubModal | null>(null);
  const [banModal, setBanModal] = useState<BanModal | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => watchAllUsers(setUsers), []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const day = todayKey();
      const entries = await Promise.all(
        users.slice(0, 100).map(async (u) => {
          const usage = await getDayUsage(u.uid, day);
          return [u.uid, usage.credits] as const;
        }),
      );
      if (!cancelled) {
        const next: Record<string, number> = {};
        for (const [uid, n] of entries) next[uid] = n;
        setUsageMap(next);
      }
    };
    if (users.length) void load();
    return () => {
      cancelled = true;
    };
  }, [users]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return users;
    return users.filter(
      (u) =>
        (u.email || '').toLowerCase().includes(s) ||
        (u.name || '').toLowerCase().includes(s) ||
        u.uid.toLowerCase().includes(s),
    );
  }, [users, q]);

  const run = async (uid: string, fn: () => Promise<void>) => {
    setBusy(uid);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setBusy(null);
    }
  };

  const liveUser = modal
    ? users.find((u) => u.uid === modal.user.uid) ?? modal.user
    : null;
  const livePlan: PlanId =
    liveUser?.plan === 'pro' || liveUser?.plan === 'max' ? liveUser.plan : 'free';
  const hasSub =
    livePlan !== 'free' &&
    typeof liveUser?.planExpiresAt === 'number' &&
    liveUser.planExpiresAt > Date.now();

  const saveSubscription = async () => {
    if (!modal) return;
    const uid = modal.user.uid;
    await run(uid, async () => {
      if (modal.mode === 'date') {
        const ms = new Date(modal.expiresLocal).getTime();
        if (!Number.isFinite(ms) || ms <= Date.now()) {
          throw new Error('Укажите дату окончания в будущем');
        }
        await setUserPlan(uid, modal.plan, { expiresAt: ms, mode: 'replace' });
      } else if (modal.mode === 'custom') {
        const days = Math.trunc(Number(modal.customDays));
        if (!Number.isFinite(days) || days === 0) {
          throw new Error('Укажите число дней (можно минус, чтобы укоротить)');
        }
        if (days < 0 && !hasSub) {
          throw new Error('Нельзя укоротить: активной подписки нет');
        }
        await setUserPlan(uid, modal.plan, {
          days,
          mode: days < 0 ? 'extend' : modal.applyMode,
        });
      } else {
        if (modal.presetDays < 0 && !hasSub) {
          throw new Error('Нельзя укоротить: активной подписки нет');
        }
        const preset = ADMIN_DURATIONS.find((d) => d.days === modal.presetDays);
        const applyMode = modal.presetDays < 0 ? 'extend' : modal.applyMode;
        if (preset?.months && modal.presetDays > 0) {
          await setUserPlan(uid, modal.plan, {
            months: preset.months,
            mode: applyMode,
          });
        } else {
          await setUserPlan(uid, modal.plan, {
            days: modal.presetDays,
            mode: applyMode,
          });
        }
      }
      setModal(null);
    });
  };

  const removeSubscription = async () => {
    if (!modal) return;
    const uid = modal.user.uid;
    await run(uid, async () => {
      await setUserPlan(uid, 'free');
      setModal(null);
    });
  };

  const applyBan = async () => {
    if (!banModal) return;
    const reason = banModal.reason.trim();
    if (!reason) {
      setError('Укажите причину бана');
      return;
    }
    const uid = banModal.user.uid;
    await run(uid, async () => {
      if (banModal.duration === 'permanent') {
        await setUserBanned(uid, true, { reason, until: null });
      } else if (banModal.duration === 'custom') {
        const days = Math.max(0, Math.floor(Number(banModal.customDays) || 0));
        const hours = Math.max(0, Math.floor(Number(banModal.customHours) || 0));
        if (days === 0 && hours === 0) throw new Error('Укажите срок бана');
        await setUserBanned(uid, true, { reason, days, hours });
      } else {
        const map = {
          '1h': { hours: 1 },
          '1d': { days: 1 },
          '7d': { days: 7 },
          '30d': { days: 30 },
        } as const;
        await setUserBanned(uid, true, { reason, ...map[banModal.duration] });
      }
      setBanModal(null);
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Пользователи</h2>
          <p className="text-sm text-[#9a8585]">Подписки, бан, права админа</p>
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск…"
          className="rounded-lg border border-[#2a1c1c] bg-[#0d0a0a] px-3 py-1.5 text-sm outline-none"
        />
      </div>

      {error && (
        <p className="rounded-lg border border-[#5c2a2a] bg-[#2a1212] px-3 py-2 text-sm text-[#e57373]">
          {error}
        </p>
      )}

      <div className="overflow-x-auto admin-panel">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="bg-[#140f0f] text-[11px] uppercase tracking-wider text-[#6e5555]">
            <tr>
              <th className="px-3 py-2 font-medium">Пользователь</th>
              <th className="px-3 py-2 font-medium">Тариф</th>
              <th className="px-3 py-2 font-medium">Таймер</th>
              <th className="px-3 py-2 font-medium">Сегодня</th>
              <th className="px-3 py-2 font-medium">Статус</th>
              <th className="px-3 py-2 font-medium">Действия</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => {
              const plan = (u.plan === 'pro' || u.plan === 'max' ? u.plan : 'free') as PlanId;
              const isAdm = Boolean(u.isAdmin || u.admin);
              const active =
                plan !== 'free' &&
                typeof u.planExpiresAt === 'number' &&
                u.planExpiresAt > Date.now();
              const bannedNow = isUserBanned(u);
              return (
                <tr key={u.uid} className="border-t border-[#2a1c1c]">
                  <td className="px-3 py-2">
                    <p className="font-medium">{u.name || '—'}</p>
                    <p className="text-[11px] text-[#9a8585]">{u.email}</p>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={
                        plan === 'free' ? 'text-[#9a8585]' : 'font-medium text-[#e8d5d5]'
                      }
                    >
                      {PLANS[plan].name}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[11px] text-[#9a8585]">
                    {active && u.planExpiresAt ? (
                      <div>
                        <PlanCountdown expiresAt={u.planExpiresAt} prefix="" />
                        <p className="mt-0.5 text-[10px] text-[#6e5555]">
                          до {new Date(u.planExpiresAt).toLocaleString('ru-RU')}
                        </p>
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-[#9a8585]">
                    {usageMap[u.uid] ?? '—'}
                    {PLANS[plan].creditsPerDay != null
                      ? ` / ${PLANS[plan].creditsPerDay} кр.`
                      : ' / ∞ кр.'}
                  </td>
                  <td className="px-3 py-2 text-[11px]">
                    <span className={bannedNow ? 'text-[#e57373]' : 'text-[#9a8585]'}>
                      {bannedNow ? 'ban' : 'ok'}
                    </span>
                    {' · '}
                    <span className={isAdm ? 'text-[#c62828]' : 'text-[#9a8585]'}>
                      {isAdm ? 'admin' : 'user'}
                    </span>
                    {bannedNow && u.banReason && (
                      <p className="mt-0.5 max-w-[140px] truncate text-[10px] text-[#e57373]/80" title={u.banReason}>
                        {u.banReason}
                      </p>
                    )}
                    {(u.flagged || u.muted || u.reviewPriority) && (
                      <p className="mt-0.5 text-[10px] text-[#c9a8a8]">
                        {[
                          u.flagged ? 'flag' : null,
                          u.muted ? 'mute' : null,
                          u.reviewPriority ? `prio:${u.reviewPriority}` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        disabled={busy === u.uid}
                        onClick={() => {
                          setError(null);
                          setModal(openSubModal(u));
                        }}
                        className="rounded-md border border-[#c62828]/40 bg-[#c62828]/10 px-2 py-1 text-[11px] text-[#ff8a80] hover:bg-[#c62828]/20 disabled:opacity-40"
                      >
                        {active ? 'Изменить подписку' : 'Выдать подписку'}
                      </button>
                      <Link
                        to={`/admin/chats?uid=${u.uid}&god=1`}
                        className="rounded-md border border-[#c62828]/50 bg-[#c62828]/15 px-2 py-1 text-[11px] font-medium text-[#ff8a80] hover:bg-[#c62828]/25"
                      >
                        Режим бога
                      </Link>
                      <Link
                        to={`/admin/chats?uid=${u.uid}`}
                        className="rounded-md border border-[#2a1c1c] px-2 py-1 text-[11px] text-[#9a8585] hover:bg-white/5"
                      >
                        Чаты
                      </Link>
                      <button
                        type="button"
                        disabled={busy === u.uid}
                        onClick={() => {
                          if (bannedNow) {
                            void run(u.uid, () => setUserBanned(u.uid, false));
                          } else {
                            setError(null);
                            setBanModal({
                              user: u,
                              reason: '',
                              duration: '7d',
                              customDays: '3',
                              customHours: '0',
                            });
                          }
                        }}
                        className="rounded-md border border-[#2a1c1c] px-2 py-1 text-[11px] text-[#9a8585] hover:bg-white/5"
                      >
                        {bannedNow ? 'Разбан' : 'Бан'}
                      </button>
                      <button
                        type="button"
                        disabled={busy === u.uid}
                        onClick={() =>
                          void run(u.uid, () => setUserIsAdmin(u.uid, !isAdm))
                        }
                        className="rounded-md border border-[#2a1c1c] px-2 py-1 text-[11px] text-[#9a8585] hover:bg-white/5"
                      >
                        {isAdm ? 'Снять admin' : 'Сделать admin'}
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!filtered.length && (
          <p className="p-6 text-center text-sm text-[#6e5555]">Никого не найдено</p>
        )}
      </div>

      {modal && liveUser && (
        <div
          className="admin-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => busy !== liveUser.uid && setModal(null)}
        >
          <div
            className="admin-modal-card w-full max-w-md rounded-2xl border border-[#2a1c1c] bg-[#140f0f] p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-[#f5ecec]">
              {hasSub ? 'Управление подпиской' : 'Выдать подписку'}
            </h3>
            <p className="mt-1 text-sm text-[#9a8585]">
              {liveUser.name || 'Пользователь'} · {liveUser.email}
            </p>

            {hasSub && liveUser.planExpiresAt && (
              <div className="mt-3 rounded-lg border border-[#2a1c1c] bg-[#0d0a0a] px-3 py-2 text-xs text-[#9a8585]">
                Сейчас: <span className="text-[#e8d5d5]">{PLANS[livePlan].name}</span>
                {' · '}
                <PlanCountdown expiresAt={liveUser.planExpiresAt} prefix="осталось " />
                <p className="mt-0.5 text-[10px] text-[#6e5555]">
                  до {new Date(liveUser.planExpiresAt).toLocaleString('ru-RU')}
                </p>
              </div>
            )}

            <div className="mt-4 space-y-4">
              <div>
                <p className="mb-1.5 text-[11px] uppercase tracking-wider text-[#6e5555]">
                  Тариф
                </p>
                <div className="flex gap-2">
                  {(['pro', 'max'] as const).map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setModal({ ...modal, plan: id })}
                      className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                        modal.plan === id
                          ? 'border-[#c62828] bg-[#c62828]/15 text-[#ff8a80]'
                          : 'border-[#2a1c1c] text-[#9a8585] hover:bg-white/5'
                      }`}
                    >
                      {PLANS[id].name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-[11px] uppercase tracking-wider text-[#6e5555]">
                  Срок
                </p>
                <div className="mb-2 flex gap-1">
                  {(
                    [
                      ['preset', 'Пресет'],
                      ['custom', 'Дни'],
                      ['date', 'Дата'],
                    ] as const
                  ).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setModal({ ...modal, mode: id })}
                      className={`rounded-md px-2.5 py-1 text-[11px] ${
                        modal.mode === id
                          ? 'bg-[#c62828]/20 text-[#ff8a80]'
                          : 'text-[#6e5555] hover:text-[#9a8585]'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {modal.mode === 'preset' && (
                  <div className="grid grid-cols-2 gap-1.5">
                    {ADMIN_DURATIONS.map((d) => (
                      <button
                        key={d.days}
                        type="button"
                        onClick={() =>
                          setModal({
                            ...modal,
                            presetDays: d.days,
                            // минус всегда от текущего конца; плюс при активной подписке — продлить
                            applyMode:
                              d.days < 0 || hasSub ? 'extend' : modal.applyMode,
                          })
                        }
                        className={`rounded-lg border px-2 py-2 text-xs ${
                          modal.presetDays === d.days
                            ? d.days < 0
                              ? 'border-[#e57373]/60 bg-[#2a1212] text-[#e57373]'
                              : 'border-[#c62828] bg-[#c62828]/10 text-[#ff8a80]'
                            : d.days < 0
                              ? 'border-[#2a1c1c] text-[#e57373]/80 hover:bg-[#2a1212]/40'
                              : 'border-[#2a1c1c] text-[#9a8585] hover:bg-white/5'
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                )}

                {modal.mode === 'custom' && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={-3650}
                        max={3650}
                        value={modal.customDays}
                        onChange={(e) => {
                          const v = e.target.value;
                          const n = Number(v);
                          setModal({
                            ...modal,
                            customDays: v,
                            applyMode:
                              n < 0 || hasSub ? 'extend' : modal.applyMode,
                          });
                        }}
                        className="w-28 rounded-lg border border-[#2a1c1c] bg-[#0d0a0a] px-3 py-2 text-sm outline-none focus:border-[#c62828]/50"
                      />
                      <span className="text-sm text-[#9a8585]">дней</span>
                    </div>
                    <p className="text-[10px] text-[#6e5555]">
                      Минус (−7) укорачивает текущий срок
                    </p>
                  </div>
                )}

                {modal.mode === 'date' && (
                  <input
                    type="datetime-local"
                    value={modal.expiresLocal}
                    onChange={(e) =>
                      setModal({ ...modal, expiresLocal: e.target.value })
                    }
                    className="w-full rounded-lg border border-[#2a1c1c] bg-[#0d0a0a] px-3 py-2 text-sm outline-none focus:border-[#c62828]/50"
                  />
                )}
              </div>

              {modal.mode !== 'date' &&
                !(modal.mode === 'preset' && modal.presetDays < 0) &&
                !(modal.mode === 'custom' && Number(modal.customDays) < 0) && (
                <div>
                  <p className="mb-1.5 text-[11px] uppercase tracking-wider text-[#6e5555]">
                    Как применить
                    {hasSub && (
                      <span className="ml-1 normal-case tracking-normal text-[#6e5555]/80">
                        (по умолчанию — продлить)
                      </span>
                    )}
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setModal({ ...modal, applyMode: 'replace' })}
                      className={`flex-1 rounded-lg border px-2 py-2 text-[11px] ${
                        modal.applyMode === 'replace'
                          ? 'border-[#c62828] bg-[#c62828]/10 text-[#ff8a80]'
                          : 'border-[#2a1c1c] text-[#9a8585]'
                      }`}
                    >
                      От сейчас
                      <span className="mt-0.5 block text-[10px] opacity-70">
                        заменить срок
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setModal({ ...modal, applyMode: 'extend' })}
                      className={`flex-1 rounded-lg border px-2 py-2 text-[11px] ${
                        modal.applyMode === 'extend'
                          ? 'border-[#c62828] bg-[#c62828]/10 text-[#ff8a80]'
                          : 'border-[#2a1c1c] text-[#9a8585]'
                      }`}
                    >
                      Продлить
                      <span className="mt-0.5 block text-[10px] opacity-70">
                        добавить к текущему
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {((modal.mode === 'preset' && modal.presetDays < 0) ||
                (modal.mode === 'custom' && Number(modal.customDays) < 0)) && (
                <p className="rounded-lg border border-[#2a1c1c] bg-[#0d0a0a] px-3 py-2 text-[11px] text-[#9a8585]">
                  Минусовой срок вычитается из текущей даты окончания подписки.
                  Если остаток станет нулевым — подписка снимется.
                </p>
              )}
            </div>

            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                disabled={busy === liveUser.uid}
                onClick={() => void saveSubscription()}
                className="rounded-lg bg-[#c62828] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#b71c1c] disabled:opacity-50"
              >
                {busy === liveUser.uid
                  ? 'Сохранение…'
                  : hasSub
                    ? 'Сохранить изменения'
                    : 'Выдать подписку'}
              </button>
              {hasSub && (
                <button
                  type="button"
                  disabled={busy === liveUser.uid}
                  onClick={() => void removeSubscription()}
                  className="rounded-lg border border-[#5c2a2a] px-4 py-2 text-sm text-[#e57373] hover:bg-[#2a1212] disabled:opacity-50"
                >
                  Снять подписку
                </button>
              )}
              <button
                type="button"
                disabled={busy === liveUser.uid}
                onClick={() => setModal(null)}
                className="rounded-lg px-4 py-2 text-sm text-[#6e5555] hover:text-[#9a8585]"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {banModal && (
        <div
          className="admin-modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => busy !== banModal.user.uid && setBanModal(null)}
        >
          <div
            className="admin-modal-card w-full max-w-md rounded-2xl border border-[#2a1c1c] bg-[#140f0f] p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-[#f5ecec]">Заблокировать аккаунт</h3>
            <p className="mt-1 text-sm text-[#9a8585]">
              {banModal.user.name || 'Пользователь'} · {banModal.user.email}
            </p>

            <label className="mt-4 block text-[11px] uppercase tracking-wider text-[#6e5555]">
              Причина (увидит пользователь)
              <textarea
                value={banModal.reason}
                onChange={(e) => setBanModal({ ...banModal, reason: e.target.value })}
                rows={3}
                placeholder="Например: спам / оскорбления / злоупотребление API…"
                className="mt-1.5 w-full resize-y rounded-lg border border-[#2a1c1c] bg-[#0d0a0a] px-3 py-2 text-sm text-[#f5ecec] outline-none focus:border-[#c62828]/50"
              />
            </label>

            <div className="mt-4">
              <p className="mb-1.5 text-[11px] uppercase tracking-wider text-[#6e5555]">Срок</p>
              <div className="grid grid-cols-3 gap-1.5">
                {(
                  [
                    ['1h', '1 час'],
                    ['1d', '1 день'],
                    ['7d', '7 дней'],
                    ['30d', '30 дней'],
                    ['permanent', 'Навсегда'],
                    ['custom', 'Свой'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setBanModal({ ...banModal, duration: id })}
                    className={`rounded-lg border px-2 py-2 text-[11px] ${
                      banModal.duration === id
                        ? 'border-[#c62828] bg-[#c62828]/10 text-[#ff8a80]'
                        : 'border-[#2a1c1c] text-[#9a8585] hover:bg-white/5'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {banModal.duration === 'custom' && (
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="number"
                    min={0}
                    value={banModal.customDays}
                    onChange={(e) =>
                      setBanModal({ ...banModal, customDays: e.target.value })
                    }
                    className="w-20 rounded-lg border border-[#2a1c1c] bg-[#0d0a0a] px-2 py-1.5 text-sm outline-none"
                  />
                  <span className="text-xs text-[#9a8585]">дн.</span>
                  <input
                    type="number"
                    min={0}
                    value={banModal.customHours}
                    onChange={(e) =>
                      setBanModal({ ...banModal, customHours: e.target.value })
                    }
                    className="w-20 rounded-lg border border-[#2a1c1c] bg-[#0d0a0a] px-2 py-1.5 text-sm outline-none"
                  />
                  <span className="text-xs text-[#9a8585]">ч.</span>
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                disabled={busy === banModal.user.uid}
                onClick={() => void applyBan()}
                className="rounded-lg bg-[#c62828] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#b71c1c] disabled:opacity-50"
              >
                {busy === banModal.user.uid ? 'Блокировка…' : 'Забанить'}
              </button>
              <button
                type="button"
                disabled={busy === banModal.user.uid}
                onClick={() => setBanModal(null)}
                className="rounded-lg px-4 py-2 text-sm text-[#6e5555] hover:text-[#9a8585]"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
