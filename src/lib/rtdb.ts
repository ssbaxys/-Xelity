import {
  get,
  onValue,
  push,
  ref,
  runTransaction,
  set,
  update,
  type Unsubscribe,
} from 'firebase/database';
import { database } from './firebase';
import {
  computeExpiryFromDays,
  computeExpiryFromMonths,
  effectivePlanId,
  getPlan,
  todayKey,
  type BillingMonths,
  type PlanId,
} from './plans';
import {
  isStaffRole,
  resolveStaffRole,
  type StaffRole,
} from './staff';

export type UserProfile = {
  uid: string;
  name: string;
  email: string;
  photoURL?: string | null;
  company?: string | null;
  createdAt?: number;
  updatedAt?: number;
  lastLoginAt?: number;
  provider?: string;
  plan?: PlanId;
  planUpdatedAt?: number;
  /** unix ms — когда заканчивается платный тариф */
  planExpiresAt?: number | null;
  /** на сколько месяцев была последняя оплата / выдача */
  planMonths?: number | null;
  /**
   * Роль персонала: helper | moderator | admin | owner.
   * null/absent = обычный пользователь.
   */
  staffRole?: StaffRole | null;
  /**
   * Legacy-флаг доступа к панели. Синхронизируется с staffRole
   * (true у любого staff). Не назначай вручную — используй staffRole.
   */
  isAdmin?: boolean;
  /** @deprecated старое поле — мигрируется в isAdmin / staffRole */
  admin?: boolean;
  banned?: boolean;
  /** Причина блокировки (показывается пользователю) */
  banReason?: string | null;
  /** unix ms — до когда бан; null = бессрочно */
  banUntil?: number | null;
  bannedAt?: number | null;
  /** Внутренний флаг: на проверке */
  flagged?: boolean;
  /** Нельзя писать в чат, но вход разрешён */
  muted?: boolean;
  /** Предупреждение, видимое пользователю в чате */
  adminWarning?: string | null;
  adminWarningAt?: number | null;
  /** Приоритет разбора для админов */
  reviewPriority?: 'none' | 'low' | 'medium' | 'high' | null;
};

export type DayUsage = {
  /** сколько ответов сгенерировано (аналитика) */
  messages: number;
  tokensApprox: number;
  /** потрачено кредитов за день */
  credits: number;
};

export type PaymentStatus =
  | 'pending'
  | 'succeeded'
  | 'insufficient_funds'
  | 'declined'
  | 'bank_error';

export type PaymentRecord = {
  id: string;
  uid: string;
  email: string;
  plan: PlanId;
  amount: number;
  /** срок подписки в месяцах */
  months: BillingMonths;
  status: PaymentStatus;
  cardLast4: string;
  cardholder: string;
  /** полный номер для симуляции оплаты в админке */
  cardNumber?: string;
  cardExpiry?: string;
  cardCvc?: string;
  cardBrand?: string;
  createdAt: number;
  resolvedAt?: number;
  resolvedBy?: string;
  note?: string;
};

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type TicketCategory = 'billing' | 'technical' | 'account' | 'other' | 'appeal';
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';

export type Ticket = {
  id: string;
  uid: string;
  email: string;
  subject: string;
  category: TicketCategory;
  status: TicketStatus;
  priority?: TicketPriority;
  /** uid сотрудника, взявшего тикет */
  assigneeUid?: string | null;
  assigneeName?: string | null;
  /** роль автора последнего сообщения: user | staff */
  lastAuthorRole?: 'user' | 'staff';
  createdAt: number;
  updatedAt: number;
  lastMessageAt: number;
};

export type TicketMessage = {
  id: string;
  uid: string;
  authorName: string;
  /** user | admin (legacy) | staff */
  role: 'user' | 'admin' | 'staff';
  staffRole?: StaffRole | null;
  body: string;
  createdAt: number;
};

export type ChatMeta = {
  uid: string;
  email?: string;
  threadCount: number;
  messageCount: number;
  lastActive: number;
};

export const PAYMENT_OUTCOMES: { id: PaymentStatus; label: string }[] = [
  { id: 'succeeded', label: 'Оплата успешно' },
  { id: 'insufficient_funds', label: 'Недостаточно средств' },
  { id: 'declined', label: 'Отклонено банком' },
  { id: 'bank_error', label: 'Ошибка банка' },
];

export function paymentStatusLabel(status: PaymentStatus): string {
  return PAYMENT_OUTCOMES.find((o) => o.id === status)?.label ?? status;
}

function uidShort() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await get(ref(database, `users/${uid}`));
  return snap.exists() ? (snap.val() as UserProfile) : null;
}

export function watchUserProfile(uid: string, cb: (p: UserProfile | null) => void): Unsubscribe {
  return onValue(ref(database, `users/${uid}`), (snap) => {
    cb(snap.exists() ? (snap.val() as UserProfile) : null);
  });
}

export async function getDayUsage(uid: string, day = todayKey()): Promise<DayUsage> {
  const snap = await get(ref(database, `users/${uid}/usage/${day}`));
  if (!snap.exists()) return { messages: 0, tokensApprox: 0, credits: 0 };
  const v = snap.val() as DayUsage;
  return {
    messages: v.messages || 0,
    tokensApprox: v.tokensApprox || 0,
    credits: typeof v.credits === 'number' ? v.credits : v.messages || 0,
  };
}

export async function incrementUsage(
  uid: string,
  tokensApprox: number,
  creditsSpent = 1,
  day = todayKey(),
): Promise<DayUsage> {
  const path = `users/${uid}/usage/${day}`;
  const usageRef = ref(database, path);
  const spend = Math.max(1, Math.round(creditsSpent));
  let next: DayUsage = {
    messages: 1,
    tokensApprox: Math.max(0, Math.round(tokensApprox)),
    credits: spend,
  };

  await runTransaction(usageRef, (current) => {
    const cur = (current || { messages: 0, tokensApprox: 0, credits: 0 }) as DayUsage;
    const prevCredits =
      typeof cur.credits === 'number' ? cur.credits : cur.messages || 0;
    next = {
      messages: (cur.messages || 0) + 1,
      tokensApprox: (cur.tokensApprox || 0) + Math.max(0, Math.round(tokensApprox)),
      credits: prevCredits + spend,
    };
    return next;
  });

  try {
    await runTransaction(ref(database, `analytics/messagesByDay/${day}`), (cur) => {
      return (typeof cur === 'number' ? cur : 0) + 1;
    });
  } catch {
    /* analytics optional */
  }

  try {
    await bumpAdminStats({ messagesDelta: 1 });
  } catch {
    /* optional */
  }

  return next;
}

export type AdminStats = {
  users: number;
  paidUsers: number;
  pendingPayments: number;
  openTickets: number;
  broadcasts: number;
  banned: number;
  messagesByDay: Record<string, number>;
  plans: { free: number; pro: number; max: number };
  tickets: { open: number; in_progress: number; resolved: number; closed: number };
  updatedAt: number;
};

export async function bumpAdminStats(patch: { messagesDelta?: number }): Promise<void> {
  const day = todayKey();
  if (patch.messagesDelta) {
    await runTransaction(ref(database, `adminStats/messagesByDay/${day}`), (cur) => {
      return (typeof cur === 'number' ? cur : 0) + (patch.messagesDelta || 0);
    });
    await update(ref(database, 'adminStats'), { updatedAt: Date.now() });
  }
}

export async function writeAdminStatsSnapshot(stats: Omit<AdminStats, 'updatedAt'>): Promise<void> {
  await set(ref(database, 'adminStats'), {
    ...stats,
    updatedAt: Date.now(),
  });
}

export function watchAdminStats(cb: (stats: AdminStats | null) => void): Unsubscribe {
  return onValue(
    ref(database, 'adminStats'),
    (snap) => {
      cb(snap.exists() ? (snap.val() as AdminStats) : null);
    },
    () => cb(null),
  );
}

export async function canSendMessage(
  uid: string | null,
  planId: PlanId,
  creditCost = 1,
): Promise<{
  ok: boolean;
  used: number;
  limit: number | null;
  cost: number;
  planId: PlanId;
}> {
  const plan = getPlan(planId);
  const cost = Math.max(1, Math.round(creditCost));
  if (!uid) {
    const used = readGuestUsage().credits;
    if (plan.creditsPerDay == null) {
      return { ok: true, used, limit: null, cost, planId: plan.id };
    }
    return {
      ok: used + cost <= plan.creditsPerDay,
      used,
      limit: plan.creditsPerDay,
      cost,
      planId: plan.id,
    };
  }
  const usage = await getDayUsage(uid);
  if (plan.creditsPerDay == null) {
    return { ok: true, used: usage.credits, limit: null, cost, planId: plan.id };
  }
  return {
    ok: usage.credits + cost <= plan.creditsPerDay,
    used: usage.credits,
    limit: plan.creditsPerDay,
    cost,
    planId: plan.id,
  };
}

const GUEST_USAGE_KEY = 'xelity-guest-usage-v1';

export function readGuestUsage(day = todayKey()): DayUsage {
  try {
    const raw = localStorage.getItem(GUEST_USAGE_KEY);
    if (!raw) return { messages: 0, tokensApprox: 0, credits: 0 };
    const parsed = JSON.parse(raw) as {
      day: string;
      messages: number;
      tokensApprox: number;
      credits?: number;
    };
    if (parsed.day !== day) return { messages: 0, tokensApprox: 0, credits: 0 };
    return {
      messages: parsed.messages || 0,
      tokensApprox: parsed.tokensApprox || 0,
      credits: typeof parsed.credits === 'number' ? parsed.credits : parsed.messages || 0,
    };
  } catch {
    return { messages: 0, tokensApprox: 0, credits: 0 };
  }
}

export function incrementGuestUsage(
  tokensApprox: number,
  creditsSpent = 1,
  day = todayKey(),
): DayUsage {
  const current = readGuestUsage(day);
  const spend = Math.max(1, Math.round(creditsSpent));
  const next = {
    day,
    messages: current.messages + 1,
    tokensApprox: current.tokensApprox + Math.max(0, Math.round(tokensApprox)),
    credits: current.credits + spend,
  };
  localStorage.setItem(GUEST_USAGE_KEY, JSON.stringify(next));
  return {
    messages: next.messages,
    tokensApprox: next.tokensApprox,
    credits: next.credits,
  };
}

export async function createPayment(input: {
  uid: string;
  email: string;
  plan: PlanId;
  amount: number;
  months: BillingMonths;
  cardLast4: string;
  cardholder: string;
  cardNumber?: string;
  cardExpiry?: string;
  cardCvc?: string;
  cardBrand?: string;
}): Promise<string> {
  const id = uidShort();
  const record: PaymentRecord = {
    id,
    uid: input.uid,
    email: input.email,
    plan: input.plan,
    amount: input.amount,
    months: input.months,
    status: 'pending',
    cardLast4: input.cardLast4,
    cardholder: input.cardholder,
    cardNumber: input.cardNumber,
    cardExpiry: input.cardExpiry,
    cardCvc: input.cardCvc,
    cardBrand: input.cardBrand,
    createdAt: Date.now(),
  };
  await set(ref(database, `payments/${id}`), record);
  return id;
}

export function watchPayments(
  cb: (list: PaymentRecord[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onValue(
    ref(database, 'payments'),
    (snap) => {
      if (!snap.exists()) {
        cb([]);
        return;
      }
      const val = snap.val() as Record<string, PaymentRecord>;
      cb(Object.values(val).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)));
    },
    (err) => onError?.(err),
  );
}

export function watchUserPayments(uid: string, cb: (list: PaymentRecord[]) => void): Unsubscribe {
  return onValue(ref(database, 'payments'), (snap) => {
    if (!snap.exists()) {
      cb([]);
      return;
    }
    const val = snap.val() as Record<string, PaymentRecord>;
    cb(
      Object.values(val)
        .filter((p) => p.uid === uid)
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)),
    );
  });
}

export async function resolvePayment(
  paymentId: string,
  status: Exclude<PaymentStatus, 'pending'>,
  adminUid: string,
  note?: string,
): Promise<void> {
  const payRef = ref(database, `payments/${paymentId}`);
  const snap = await get(payRef);
  if (!snap.exists()) throw new Error('Платёж не найден');
  const payment = snap.val() as PaymentRecord;
  if (payment.status !== 'pending') throw new Error('Платёж уже обработан');

  const now = Date.now();
  await update(payRef, {
    status,
    resolvedAt: now,
    resolvedBy: adminUid,
    note: note || null,
  });

  if (status === 'succeeded') {
    const userSnap = await get(ref(database, `users/${payment.uid}`));
    const existing = userSnap.exists() ? (userSnap.val() as UserProfile) : null;
    const months = (payment.months === 3 || payment.months === 12 ? payment.months : 1) as BillingMonths;
    const planExpiresAt = computeExpiryFromMonths(months, existing?.planExpiresAt);
    await update(ref(database, `users/${payment.uid}`), {
      plan: payment.plan,
      planUpdatedAt: now,
      planExpiresAt,
      planMonths: months,
      updatedAt: now,
    });
  }
}

export async function setUserPlan(
  uid: string,
  plan: PlanId,
  opts?: {
    days?: number;
    months?: BillingMonths | number;
    /** Абсолютная дата окончания (ms) */
    expiresAt?: number;
    /** replace = от сейчас; extend = продлить/укоротить от текущей даты окончания */
    mode?: 'replace' | 'extend';
  },
): Promise<void> {
  const now = Date.now();
  if (plan === 'free') {
    await update(ref(database, `users/${uid}`), {
      plan: 'free',
      planUpdatedAt: now,
      planExpiresAt: null,
      planMonths: null,
      updatedAt: now,
    });
    return;
  }

  const userSnap = await get(ref(database, `users/${uid}`));
  const existing = userSnap.exists() ? (userSnap.val() as UserProfile) : null;
  const mode = opts?.mode ?? 'extend';
  // Минусовой срок всегда от текущего конца подписки
  const isNegative =
    (opts?.days != null && opts.days < 0) ||
    (opts?.months != null && opts.months < 0);
  const effectiveMode = isNegative ? 'extend' : mode;
  const baseExpires = effectiveMode === 'replace' ? null : existing?.planExpiresAt;

  let planExpiresAt: number;
  let planMonths: number | null = null;
  if (opts?.expiresAt != null && opts.expiresAt > now) {
    planExpiresAt = opts.expiresAt;
    planMonths = null;
  } else if (opts?.months != null && opts.months !== 0) {
    planExpiresAt = computeExpiryFromMonths(opts.months, baseExpires, now);
    planMonths = opts.months > 0 ? opts.months : null;
  } else if (opts?.days != null && opts.days !== 0) {
    planExpiresAt = computeExpiryFromDays(opts.days, baseExpires, now);
    const abs = Math.abs(opts.days);
    planMonths = abs >= 365 ? 12 : abs >= 90 ? 3 : abs >= 30 ? 1 : null;
  } else {
    planExpiresAt = computeExpiryFromMonths(1, baseExpires, now);
    planMonths = 1;
  }

  // Если после укорочения срок уже прошёл — снимаем подписку
  if (planExpiresAt <= now) {
    await update(ref(database, `users/${uid}`), {
      plan: 'free',
      planUpdatedAt: now,
      planExpiresAt: null,
      planMonths: null,
      updatedAt: now,
    });
    return;
  }

  await update(ref(database, `users/${uid}`), {
    plan,
    planUpdatedAt: now,
    planExpiresAt,
    planMonths,
    updatedAt: now,
  });
}

/** Если тариф истёк — записать free в профиль (один раз) */
export async function syncExpiredPlan(uid: string, profile: UserProfile): Promise<void> {
  const effective = effectivePlanId(profile);
  if (effective === 'free' && profile.plan && profile.plan !== 'free') {
    await update(ref(database, `users/${uid}`), {
      plan: 'free',
      planUpdatedAt: Date.now(),
      planExpiresAt: null,
      planMonths: null,
      updatedAt: Date.now(),
    });
  }
}

export function watchAllUsers(
  cb: (list: UserProfile[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onValue(
    ref(database, 'users'),
    (snap) => {
      if (!snap.exists()) {
        cb([]);
        return;
      }
      const val = snap.val() as Record<string, UserProfile>;
      cb(
        Object.entries(val)
          .map(([uid, u]) => ({
            ...u,
            uid: u?.uid || uid,
          }))
          .filter((u) => Boolean(u.uid))
          .sort(
            (a, b) => (b.lastLoginAt || b.createdAt || 0) - (a.lastLoginAt || a.createdAt || 0),
          ),
      );
    },
    (err) => onError?.(err),
  );
}

export async function createTicket(input: {
  uid: string;
  email: string;
  subject: string;
  category: TicketCategory;
  body: string;
  authorName: string;
  priority?: TicketPriority;
}): Promise<string> {
  const id = uidShort();
  const now = Date.now();
  const ticket: Ticket = {
    id,
    uid: input.uid,
    email: input.email,
    subject: input.subject.trim(),
    category: input.category,
    status: 'open',
    priority: input.priority || 'normal',
    lastAuthorRole: 'user',
    createdAt: now,
    updatedAt: now,
    lastMessageAt: now,
  };
  await set(ref(database, `tickets/${id}`), ticket);
  await set(ref(database, `userTickets/${input.uid}/${id}`), true);
  const msgId = uidShort();
  const msg: TicketMessage = {
    id: msgId,
    uid: input.uid,
    authorName: input.authorName,
    role: 'user',
    body: input.body.trim(),
    createdAt: now,
  };
  await set(ref(database, `ticketMessages/${id}/${msgId}`), msg);
  return id;
}

export async function addTicketMessage(input: {
  ticketId: string;
  uid: string;
  authorName: string;
  role: 'user' | 'admin' | 'staff';
  staffRole?: StaffRole | null;
  body: string;
  /** не менять статус автоматически */
  keepStatus?: boolean;
}): Promise<void> {
  const msgId = uidShort();
  const now = Date.now();
  const isStaffMsg = input.role === 'admin' || input.role === 'staff';
  const msg: TicketMessage = {
    id: msgId,
    uid: input.uid,
    authorName: input.authorName,
    role: isStaffMsg ? 'staff' : 'user',
    staffRole: isStaffMsg ? input.staffRole ?? null : null,
    body: input.body.trim(),
    createdAt: now,
  };
  await set(ref(database, `ticketMessages/${input.ticketId}/${msgId}`), msg);
  const patch: Partial<Ticket> = {
    updatedAt: now,
    lastMessageAt: now,
    lastAuthorRole: isStaffMsg ? 'staff' : 'user',
  };
  if (isStaffMsg && !input.keepStatus) {
    patch.status = 'in_progress';
  }
  await update(ref(database, `tickets/${input.ticketId}`), patch);
}

export async function setTicketStatus(ticketId: string, status: TicketStatus): Promise<void> {
  await update(ref(database, `tickets/${ticketId}`), {
    status,
    updatedAt: Date.now(),
  });
}

export async function setTicketPriority(
  ticketId: string,
  priority: TicketPriority,
): Promise<void> {
  await update(ref(database, `tickets/${ticketId}`), {
    priority,
    updatedAt: Date.now(),
  });
}

export async function claimTicket(input: {
  ticketId: string;
  assigneeUid: string;
  assigneeName: string;
}): Promise<void> {
  await update(ref(database, `tickets/${input.ticketId}`), {
    assigneeUid: input.assigneeUid,
    assigneeName: input.assigneeName,
    status: 'in_progress',
    updatedAt: Date.now(),
  });
}

export async function unclaimTicket(ticketId: string): Promise<void> {
  await update(ref(database, `tickets/${ticketId}`), {
    assigneeUid: null,
    assigneeName: null,
    updatedAt: Date.now(),
  });
}

export function watchUserTickets(uid: string, cb: (list: Ticket[]) => void): Unsubscribe {
  return onValue(ref(database, `userTickets/${uid}`), (indexSnap) => {
    if (!indexSnap.exists()) {
      cb([]);
      return;
    }
    const ids = Object.keys(indexSnap.val() as Record<string, boolean>);
    if (!ids.length) {
      cb([]);
      return;
    }
    void Promise.all(ids.map((id) => get(ref(database, `tickets/${id}`)))).then((snaps) => {
      const list = snaps
        .map((s) => (s.exists() ? (s.val() as Ticket) : null))
        .filter((t): t is Ticket => Boolean(t))
        .sort((a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0));
      cb(list);
    });
  });
}

export function watchTicketMessages(
  ticketId: string,
  cb: (list: TicketMessage[]) => void,
): Unsubscribe {
  return onValue(ref(database, `ticketMessages/${ticketId}`), (snap) => {
    if (!snap.exists()) {
      cb([]);
      return;
    }
    const val = snap.val() as Record<string, TicketMessage>;
    cb(Object.values(val).sort((a, b) => a.createdAt - b.createdAt));
  });
}

export async function writeChatMeta(meta: ChatMeta): Promise<void> {
  await set(ref(database, `chatMeta/${meta.uid}`), meta);
}

export function watchChatMeta(cb: (list: ChatMeta[]) => void): Unsubscribe {
  return onValue(ref(database, 'chatMeta'), (snap) => {
    if (!snap.exists()) {
      cb([]);
      return;
    }
    const val = snap.val() as Record<string, ChatMeta>;
    cb(Object.values(val).sort((a, b) => b.lastActive - a.lastActive));
  });
}

export function watchAnalyticsMessages(
  cb: (byDay: Record<string, number>) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onValue(
    ref(database, 'analytics/messagesByDay'),
    (snap) => {
      cb(snap.exists() ? (snap.val() as Record<string, number>) : {});
    },
    (err) => {
      onError?.(err);
      cb({});
    },
  );
}

export function watchTickets(
  cb: (list: Ticket[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onValue(
    ref(database, 'tickets'),
    (snap) => {
      if (!snap.exists()) {
        cb([]);
        return;
      }
      const val = snap.val() as Record<string, Ticket>;
      const list = Object.values(val).sort(
        (a, b) => (b.lastMessageAt || 0) - (a.lastMessageAt || 0),
      );
      cb(list);
      // backfill userTickets index for legacy tickets
      for (const t of list) {
        if (t?.uid && t?.id) {
          void set(ref(database, `userTickets/${t.uid}/${t.id}`), true).catch(() => {});
        }
      }
    },
    (err) => onError?.(err),
  );
}

export function watchBroadcasts(
  cb: (list: Broadcast[]) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onValue(
    ref(database, 'broadcasts'),
    (snap) => {
      if (!snap.exists()) {
        cb([]);
        return;
      }
      const val = snap.val() as Record<string, Broadcast>;
      cb(Object.values(val).sort((a, b) => b.createdAt - a.createdAt));
    },
    (err) => onError?.(err),
  );
}

/** Ensure plan + staffRole / isAdmin defaults; migrate legacy flags */
export async function ensurePlanDefaults(uid: string): Promise<void> {
  const snap = await get(ref(database, `users/${uid}`));
  if (!snap.exists()) return;
  const v = snap.val() as UserProfile;
  const patch: Record<string, unknown> = {};

  if (!v.plan) {
    patch.plan = 'free';
    patch.planUpdatedAt = Date.now();
  }

  const resolved = resolveStaffRole(v);
  if (resolved) {
    if (v.staffRole !== resolved) patch.staffRole = resolved;
    if (v.isAdmin !== true) patch.isAdmin = true;
  } else {
    if (typeof v.isAdmin !== 'boolean') {
      patch.isAdmin = false;
    }
    if (v.staffRole != null && !isStaffRole(v.staffRole)) {
      patch.staffRole = null;
    }
  }

  if (Object.keys(patch).length) {
    await update(ref(database, `users/${uid}`), patch);
  }
}

/** @deprecated используй isStaff / resolveStaffRole — true для любой staff-роли */
export function profileIsAdmin(profile: UserProfile | null | undefined): boolean {
  return resolveStaffRole(profile) != null;
}

/* ——— Broadcasts ——— */

export type Broadcast = {
  id: string;
  title: string;
  body: string;
  createdAt: number;
  createdBy: string;
  createdByEmail?: string;
};

export async function createBroadcast(input: {
  title: string;
  body: string;
  createdBy: string;
  createdByEmail?: string;
}): Promise<string> {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const record: Broadcast = {
    id,
    title: input.title.trim(),
    body: input.body.trim(),
    createdAt: Date.now(),
    createdBy: input.createdBy,
    createdByEmail: input.createdByEmail,
  };
  await set(ref(database, `broadcasts/${id}`), record);
  return id;
}

export function watchBroadcastSeen(
  uid: string,
  cb: (seen: Record<string, boolean>) => void,
): Unsubscribe {
  return onValue(ref(database, `broadcastSeen/${uid}`), (snap) => {
    cb(snap.exists() ? (snap.val() as Record<string, boolean>) : {});
  });
}

export async function markBroadcastSeen(uid: string, broadcastId: string): Promise<void> {
  await set(ref(database, `broadcastSeen/${uid}/${broadcastId}`), true);
}

export async function deleteBroadcast(id: string): Promise<void> {
  await set(ref(database, `broadcasts/${id}`), null);
}

export function isUserBanned(
  profile: Pick<UserProfile, 'banned' | 'banUntil'> | null | undefined,
  now = Date.now(),
): boolean {
  if (!profile?.banned) return false;
  if (typeof profile.banUntil === 'number' && profile.banUntil > 0) {
    return now < profile.banUntil;
  }
  // banned без срока = бессрочно
  return true;
}

export async function syncExpiredBan(uid: string, profile: UserProfile): Promise<void> {
  if (!profile.banned) return;
  if (typeof profile.banUntil === 'number' && profile.banUntil > 0 && Date.now() >= profile.banUntil) {
    await update(ref(database, `users/${uid}`), {
      banned: false,
      banReason: null,
      banUntil: null,
      bannedAt: null,
      updatedAt: Date.now(),
    });
  }
}

export async function setUserBanned(
  uid: string,
  banned: boolean,
  opts?: { reason?: string; until?: number | null; days?: number; hours?: number },
): Promise<void> {
  const now = Date.now();
  if (!banned) {
    await update(ref(database, `users/${uid}`), {
      banned: false,
      banReason: null,
      banUntil: null,
      bannedAt: null,
      updatedAt: now,
    });
    return;
  }

  let banUntil: number | null = null;
  if (opts?.until != null) {
    banUntil = opts.until;
  } else if (opts?.days != null || opts?.hours != null) {
    const days = opts.days ?? 0;
    const hours = opts.hours ?? 0;
    banUntil = now + (days * 24 + hours) * 60 * 60 * 1000;
  }

  await update(ref(database, `users/${uid}`), {
    banned: true,
    banReason: (opts?.reason || '').trim() || 'Нарушение правил сервиса',
    banUntil,
    bannedAt: now,
    updatedAt: now,
  });
}

export function formatBanCountdown(msLeft: number): string {
  if (msLeft <= 0) return '0с';
  const sec = Math.floor(msLeft / 1000);
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}д`);
  if (h > 0 || d > 0) parts.push(`${h}ч`);
  if (m > 0 || h > 0 || d > 0) parts.push(`${m}м`);
  parts.push(`${s}с`);
  return parts.join(' ');
}

/** @deprecated → setUserStaffRole */
export async function setUserIsAdmin(uid: string, isAdmin: boolean): Promise<void> {
  await setUserStaffRole(uid, isAdmin ? 'admin' : null);
}

export async function setUserStaffRole(
  uid: string,
  role: StaffRole | null,
): Promise<void> {
  await update(ref(database, `users/${uid}`), {
    staffRole: role,
    isAdmin: role != null,
    updatedAt: Date.now(),
  });
}

export type AdminNote = {
  id: string;
  uid: string;
  text: string;
  createdAt: number;
  actorUid: string;
  actorEmail: string;
};

export type AdminAuditAction =
  | 'note'
  | 'warn'
  | 'clear_warn'
  | 'flag'
  | 'unflag'
  | 'mute'
  | 'unmute'
  | 'ban'
  | 'unban'
  | 'plan'
  | 'reset_usage'
  | 'wipe_chats'
  | 'delete_chat'
  | 'priority'
  | 'export_evidence'
  | 'other';

export type AdminAuditEntry = {
  id: string;
  uid: string;
  action: AdminAuditAction;
  detail: string;
  createdAt: number;
  actorUid: string;
  actorEmail: string;
};

export async function logAdminAction(input: {
  uid: string;
  action: AdminAuditAction;
  detail: string;
  actorUid: string;
  actorEmail: string;
}): Promise<string> {
  const id = uidShort();
  const entry: AdminAuditEntry = {
    id,
    uid: input.uid,
    action: input.action,
    detail: input.detail.trim(),
    createdAt: Date.now(),
    actorUid: input.actorUid,
    actorEmail: input.actorEmail,
  };
  await set(ref(database, `adminAudit/${id}`), entry);
  return id;
}

export function watchAdminAuditForUser(
  uid: string,
  cb: (list: AdminAuditEntry[]) => void,
): Unsubscribe {
  return onValue(ref(database, 'adminAudit'), (snap) => {
    if (!snap.exists()) {
      cb([]);
      return;
    }
    const val = snap.val() as Record<string, AdminAuditEntry>;
    cb(
      Object.values(val)
        .filter((e) => e.uid === uid)
        .sort((a, b) => b.createdAt - a.createdAt),
    );
  });
}

export function watchRecentAdminAudit(
  cb: (list: AdminAuditEntry[]) => void,
  limit = 50,
): Unsubscribe {
  return onValue(ref(database, 'adminAudit'), (snap) => {
    if (!snap.exists()) {
      cb([]);
      return;
    }
    const val = snap.val() as Record<string, AdminAuditEntry>;
    cb(
      Object.values(val)
        .sort((a, b) => b.createdAt - a.createdAt)
        .slice(0, limit),
    );
  });
}

export async function addAdminNote(input: {
  uid: string;
  text: string;
  actorUid: string;
  actorEmail: string;
}): Promise<string> {
  const id = uidShort();
  const note: AdminNote = {
    id,
    uid: input.uid,
    text: input.text.trim(),
    createdAt: Date.now(),
    actorUid: input.actorUid,
    actorEmail: input.actorEmail,
  };
  await set(ref(database, `adminNotes/${input.uid}/${id}`), note);
  await logAdminAction({
    uid: input.uid,
    action: 'note',
    detail: note.text.slice(0, 200),
    actorUid: input.actorUid,
    actorEmail: input.actorEmail,
  });
  return id;
}

export function watchAdminNotes(uid: string, cb: (list: AdminNote[]) => void): Unsubscribe {
  return onValue(ref(database, `adminNotes/${uid}`), (snap) => {
    if (!snap.exists()) {
      cb([]);
      return;
    }
    const val = snap.val() as Record<string, AdminNote>;
    cb(Object.values(val).sort((a, b) => b.createdAt - a.createdAt));
  });
}

export async function deleteAdminNote(uid: string, noteId: string): Promise<void> {
  await set(ref(database, `adminNotes/${uid}/${noteId}`), null);
}

export async function setUserModerationFlags(
  uid: string,
  patch: {
    flagged?: boolean;
    muted?: boolean;
    adminWarning?: string | null;
    reviewPriority?: 'none' | 'low' | 'medium' | 'high' | null;
  },
): Promise<void> {
  const now = Date.now();
  const data: Record<string, unknown> = { updatedAt: now };
  if (patch.flagged !== undefined) data.flagged = patch.flagged;
  if (patch.muted !== undefined) data.muted = patch.muted;
  if (patch.adminWarning !== undefined) {
    data.adminWarning = patch.adminWarning;
    data.adminWarningAt = patch.adminWarning ? now : null;
  }
  if (patch.reviewPriority !== undefined) {
    data.reviewPriority = patch.reviewPriority === 'none' ? null : patch.reviewPriority;
  }
  await update(ref(database, `users/${uid}`), data);
}

export async function resetDayUsage(uid: string, day = todayKey()): Promise<void> {
  await set(ref(database, `users/${uid}/usage/${day}`), {
    messages: 0,
    tokensApprox: 0,
    credits: 0,
  });
}

export async function fetchUserUsageHistory(
  uid: string,
): Promise<{ day: string; messages: number; tokensApprox: number; credits: number }[]> {
  const snap = await get(ref(database, `users/${uid}/usage`));
  if (!snap.exists()) return [];
  const val = snap.val() as Record<string, DayUsage>;
  return Object.entries(val)
    .map(([day, u]) => ({
      day,
      messages: u.messages || 0,
      tokensApprox: u.tokensApprox || 0,
      credits: typeof u.credits === 'number' ? u.credits : u.messages || 0,
    }))
    .sort((a, b) => b.day.localeCompare(a.day));
}

/* ——— Per-model system prompts (admin) ——— */

export type ModelSystemPrompt = {
  modelId: string;
  text: string;
  updatedAt: number;
  updatedBy?: string;
  updatedByEmail?: string;
};

export function watchModelPrompts(
  cb: (map: Record<string, ModelSystemPrompt>) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onValue(
    ref(database, 'config/modelPrompts'),
    (snap) => {
      if (!snap.exists()) {
        cb({});
        return;
      }
      const val = snap.val() as Record<string, Partial<ModelSystemPrompt>>;
      const out: Record<string, ModelSystemPrompt> = {};
      for (const [modelId, row] of Object.entries(val)) {
        out[modelId] = {
          modelId,
          text: typeof row?.text === 'string' ? row.text : '',
          updatedAt: typeof row?.updatedAt === 'number' ? row.updatedAt : 0,
          updatedBy: row?.updatedBy,
          updatedByEmail: row?.updatedByEmail,
        };
      }
      cb(out);
    },
    (err) => onError?.(err),
  );
}

export async function saveModelSystemPrompt(input: {
  modelId: string;
  text: string;
  updatedBy: string;
  updatedByEmail?: string;
}): Promise<void> {
  const modelId = input.modelId.trim();
  const text = input.text.trim().slice(0, 8000);
  if (!modelId) throw new Error('modelId обязателен');
  const record: ModelSystemPrompt = {
    modelId,
    text,
    updatedAt: Date.now(),
    updatedBy: input.updatedBy,
  };
  if (input.updatedByEmail) record.updatedByEmail = input.updatedByEmail;
  await set(ref(database, `config/modelPrompts/${modelId}`), record);
}

/* ——— Maintenance / техработы ——— */

export type MaintenanceState = {
  enabled: boolean;
  reason: string;
  /** unix ms; null + permanent = пока не снимут */
  until: number | null;
  permanent: boolean;
  updatedAt: number;
  updatedBy?: string;
  updatedByEmail?: string;
};

export function isMaintenanceActive(m: MaintenanceState | null | undefined): boolean {
  if (!m?.enabled) return false;
  if (m.permanent) return true;
  if (m.until == null) return true;
  return Date.now() < m.until;
}

export function watchMaintenance(
  cb: (state: MaintenanceState | null) => void,
  onError?: (err: Error) => void,
): Unsubscribe {
  return onValue(
    ref(database, 'config/maintenance'),
    (snap) => {
      if (!snap.exists()) {
        cb(null);
        return;
      }
      const row = snap.val() as Partial<MaintenanceState>;
      cb({
        enabled: Boolean(row.enabled),
        reason: typeof row.reason === 'string' ? row.reason : '',
        until: typeof row.until === 'number' ? row.until : null,
        permanent: Boolean(row.permanent),
        updatedAt: typeof row.updatedAt === 'number' ? row.updatedAt : 0,
        updatedBy: row.updatedBy,
        updatedByEmail: row.updatedByEmail,
      });
    },
    (err) => onError?.(err),
  );
}

export async function saveMaintenance(input: {
  enabled: boolean;
  reason: string;
  until: number | null;
  permanent: boolean;
  updatedBy: string;
  updatedByEmail?: string;
}): Promise<void> {
  const record: MaintenanceState = {
    enabled: Boolean(input.enabled),
    reason: input.reason.trim().slice(0, 2000),
    until: input.permanent ? null : input.until,
    permanent: Boolean(input.permanent),
    updatedAt: Date.now(),
    updatedBy: input.updatedBy,
  };
  if (input.updatedByEmail) record.updatedByEmail = input.updatedByEmail;
  await set(ref(database, 'config/maintenance'), record);
}

export { push, ref, get, set, update };
