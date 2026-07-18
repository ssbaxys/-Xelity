import { useEffect, useMemo, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { database } from '../../lib/firebase';
import { normalizeChatStore } from '../../lib/chatStore';
import { PLANS } from '../../lib/plans';
import {
  watchAdminStats,
  watchAllUsers,
  watchAnalyticsMessages,
  watchBroadcasts,
  watchPayments,
  watchTickets,
  writeAdminStatsSnapshot,
  type Broadcast,
  type PaymentRecord,
  type Ticket,
  type UserProfile,
} from '../../lib/rtdb';
import { BarChart, StatCard } from './AdminCharts';

function lastNDays(n: number) {
  const days: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    days.push(`${y}-${m}-${day}`);
  }
  return days;
}

function dayFromTs(ts: number) {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function mergeDayMaps(...maps: Record<string, number>[]) {
  const out: Record<string, number> = {};
  for (const map of maps) {
    for (const [k, v] of Object.entries(map || {})) {
      out[k] = Math.max(out[k] || 0, Number(v) || 0);
    }
  }
  return out;
}

export default function AdminDashboard() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [analyticsByDay, setAnalyticsByDay] = useState<Record<string, number>>({});
  const [statsByDay, setStatsByDay] = useState<Record<string, number>>({});
  const [chatsByDay, setChatsByDay] = useState<Record<string, number>>({});
  const [usageByDay, setUsageByDay] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const onErr = (err: Error) => {
      setError(err.message || 'Нет доступа к данным Firebase');
      setLoading(false);
    };

    const u1 = watchAllUsers((list) => {
      setUsers(list);
      setLoading(false);
      const usage: Record<string, number> = {};
      for (const u of list) {
        const raw = (u as UserProfile & { usage?: Record<string, { messages?: number }> }).usage;
        if (!raw) continue;
        for (const [day, val] of Object.entries(raw)) {
          usage[day] = (usage[day] || 0) + (val?.messages || 0);
        }
      }
      setUsageByDay(usage);
    }, onErr);

    const u2 = watchPayments(setPayments, onErr);
    const u3 = watchTickets(setTickets, onErr);
    const u4 = watchAnalyticsMessages(setAnalyticsByDay, onErr);
    const u5 = watchBroadcasts(setBroadcasts, onErr);
    const u6 = watchAdminStats((s) => {
      if (s?.messagesByDay) setStatsByDay(s.messagesByDay);
    });

    const u7 = onValue(
      ref(database, 'userChats'),
      (snap) => {
        const byDay: Record<string, number> = {};
        if (snap.exists()) {
          const val = snap.val() as Record<string, unknown>;
          for (const raw of Object.values(val)) {
            const store = normalizeChatStore(raw);
            for (const chat of store.chats) {
              for (const msg of chat.messages) {
                if (msg.role !== 'user') continue;
                const day = dayFromTs(msg.createdAt || 0);
                if (!day.startsWith('20')) continue;
                byDay[day] = (byDay[day] || 0) + 1;
              }
            }
          }
        }
        setChatsByDay(byDay);
        setLoading(false);
      },
      onErr,
    );

    return () => {
      u1();
      u2();
      u3();
      u4();
      u5();
      u6();
      u7();
    };
  }, []);

  const byDay = useMemo(
    () => mergeDayMaps(analyticsByDay, statsByDay, chatsByDay, usageByDay),
    [analyticsByDay, statsByDay, chatsByDay, usageByDay],
  );

  const planDist = useMemo(() => {
    const counts = { free: 0, pro: 0, max: 0 };
    for (const u of users) {
      const p = u.plan === 'pro' || u.plan === 'max' ? u.plan : 'free';
      counts[p] += 1;
    }
    return [
      { label: 'Free', value: counts.free },
      { label: 'Pro', value: counts.pro },
      { label: 'Max', value: counts.max },
    ];
  }, [users]);

  const msgChart = useMemo(() => {
    return lastNDays(7).map((day) => ({
      label: day.slice(5),
      value: byDay[day] || 0,
    }));
  }, [byDay]);

  const ticketDist = useMemo(() => {
    const map = { open: 0, in_progress: 0, resolved: 0, closed: 0 };
    for (const t of tickets) {
      if (t.status in map) map[t.status] += 1;
    }
    return [
      { label: 'Open', value: map.open },
      { label: 'Work', value: map.in_progress },
      { label: 'Done', value: map.resolved },
      { label: 'Close', value: map.closed },
    ];
  }, [tickets]);

  const pendingPay = payments.filter((p) => p.status === 'pending').length;
  const openTickets = tickets.filter((t) => t.status === 'open' || t.status === 'in_progress').length;
  const paidUsers = users.filter((u) => u.plan === 'pro' || u.plan === 'max').length;
  const bannedUsers = users.filter((u) => u.banned).length;

  useEffect(() => {
    if (loading || error) return;
    const t = window.setTimeout(() => {
      const plans = { free: 0, pro: 0, max: 0 };
      for (const u of users) {
        const p = u.plan === 'pro' || u.plan === 'max' ? u.plan : 'free';
        plans[p] += 1;
      }
      const ticketMap = { open: 0, in_progress: 0, resolved: 0, closed: 0 };
      for (const tk of tickets) {
        if (tk.status in ticketMap) ticketMap[tk.status] += 1;
      }
      void writeAdminStatsSnapshot({
        users: users.length,
        paidUsers,
        pendingPayments: pendingPay,
        openTickets,
        broadcasts: broadcasts.length,
        banned: bannedUsers,
        messagesByDay: byDay,
        plans,
        tickets: ticketMap,
      }).catch(() => {});
    }, 800);
    return () => window.clearTimeout(t);
  }, [
    loading,
    error,
    users,
    payments.length,
    tickets,
    broadcasts.length,
    byDay,
    paidUsers,
    pendingPay,
    openTickets,
    bannedUsers,
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Обзор</h2>
        <p className="text-sm text-[#9a8585]">
          Сводка по пользователям, сообщениям, оплатам и тикетам
          {loading ? ' · загрузка…' : ''}
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}. Проверь rules в Firebase и поле <code className="text-xs">staffRole</code> (или legacy{' '}
          <code className="text-xs">isAdmin: true</code>) у
          аккаунта.
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Пользователи" value={users.length} />
        <StatCard label="Платные планы" value={paidUsers} hint={`Pro ${PLANS.pro.priceLabel}`} />
        <StatCard label="Pending оплаты" value={pendingPay} />
        <StatCard label="Открытые тикеты" value={openTickets} />
        <StatCard label="Broadcasts" value={broadcasts.length} />
        <StatCard label="Забанено" value={bannedUsers} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="admin-panel p-4">
          <p className="mb-3 text-[12px] font-medium text-[#9a8585]">Сообщения (7 дней)</p>
          <BarChart data={msgChart} />
        </div>
        <div className="admin-panel p-4">
          <p className="mb-3 text-[12px] font-medium text-[#9a8585]">Тарифы</p>
          <BarChart data={planDist} color="#e57373" />
        </div>
        <div className="admin-panel p-4">
          <p className="mb-3 text-[12px] font-medium text-[#9a8585]">Тикеты</p>
          <BarChart data={ticketDist} color="#ef9a9a" />
        </div>
      </div>
    </div>
  );
}
