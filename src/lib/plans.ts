export type PlanId = 'free' | 'pro' | 'max';
export type BillingMonths = 1 | 3 | 12;

export type PlanDef = {
  id: PlanId;
  name: string;
  priceRub: number;
  priceLabel: string;
  /** дневной бюджет кредитов; null = без лимита */
  creditsPerDay: number | null;
  maxTokens: number;
  blurb: string;
  features: string[];
};

export const PLANS: Record<PlanId, PlanDef> = {
  free: {
    id: 'free',
    name: 'Free',
    priceRub: 0,
    priceLabel: '0 ₽',
    creditsPerDay: 40,
    maxTokens: 2048,
    blurb: 'Для знакомства с линейкой Xlaude.',
    features: [
      '40 кредитов в сутки',
      'Mini K1 — 1 кр., Pro K1 — 2 кр., Mini K2 — 4 кр., Pro K2 — 8 кр. (с рассуждениями ×2)',
      'Ответы до ~2k токенов',
    ],
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    priceRub: 990,
    priceLabel: 'от 990 ₽/мес',
    creditsPerDay: 400,
    maxTokens: 4096,
    blurb: 'Для ежедневной работы и длинных диалогов.',
    features: ['400 кредитов в сутки', 'Ответы до ~4k токенов', 'Приоритетная обработка'],
  },
  max: {
    id: 'max',
    name: 'Max',
    priceRub: 2490,
    priceLabel: 'от 2 490 ₽/мес',
    creditsPerDay: null,
    maxTokens: 8192,
    blurb: 'Без дневного потолка кредитов для команд и агентов.',
    features: ['Без лимита кредитов', 'Ответы до ~8k токенов', 'Максимальный бюджет ответа'],
  },
};

export const PLAN_ORDER: PlanId[] = ['free', 'pro', 'max'];

export const BILLING_PERIODS: {
  months: BillingMonths;
  label: string;
  short: string;
  discountLabel?: string;
}[] = [
  { months: 1, label: '1 месяц', short: '1 мес.' },
  { months: 3, label: '3 месяца', short: '3 мес.', discountLabel: '−10%' },
  { months: 12, label: '12 месяцев', short: '12 мес.', discountLabel: '−20%' },
];

/** Срок выдачи в админке (плюс — выдать/продлить, минус — укоротить) */
export const ADMIN_DURATIONS: { days: number; label: string; months?: BillingMonths | null }[] = [
  { days: 7, label: '+7 дней' },
  { days: 30, label: '+1 месяц', months: 1 },
  { days: 90, label: '+3 месяца', months: 3 },
  { days: 365, label: '+12 месяцев', months: 12 },
  { days: -7, label: '−7 дней' },
  { days: -30, label: '−1 месяц' },
  { days: -90, label: '−3 месяца' },
  { days: -365, label: '−12 месяцев' },
];

export function getPlan(id: PlanId | string | null | undefined): PlanDef {
  if (id === 'pro' || id === 'max' || id === 'free') return PLANS[id];
  return PLANS.free;
}

/** free < pro < max */
export function planRank(id: PlanId | string | null | undefined): number {
  const p = getPlan(id).id;
  if (p === 'max') return 2;
  if (p === 'pro') return 1;
  return 0;
}

export type PurchaseAction = 'buy' | 'renew' | 'upgrade' | 'blocked';

/**
 * Что можно сделать с целевым тарифом при текущем.
 * Более низкий, чем текущий — нельзя (только продление своего / апгрейд выше).
 */
export function purchaseActionFor(
  currentPlan: PlanId | string | null | undefined,
  targetPlan: PlanId,
): PurchaseAction {
  if (targetPlan === 'free') return 'blocked';
  const cur = getPlan(currentPlan).id;
  if (cur === 'free') return 'buy';
  if (cur === targetPlan) return 'renew';
  if (planRank(targetPlan) > planRank(cur)) return 'upgrade';
  return 'blocked';
}

export function periodDiscount(months: BillingMonths): number {
  if (months === 3) return 0.9;
  if (months === 12) return 0.8;
  return 1;
}

export function priceForPeriod(planId: PlanId, months: BillingMonths): number {
  if (planId === 'free') return 0;
  return Math.round(PLANS[planId].priceRub * months * periodDiscount(months));
}

export function formatPriceRub(amount: number): string {
  return `${amount.toLocaleString('ru-RU')} ₽`;
}

export function addMonthsMs(fromMs: number, months: number): number {
  const d = new Date(fromMs);
  d.setMonth(d.getMonth() + months);
  return d.getTime();
}

export function addDaysMs(fromMs: number, days: number): number {
  return fromMs + days * 24 * 60 * 60 * 1000;
}

export function computeExpiryFromMonths(
  months: number,
  currentExpiresAt?: number | null,
  now = Date.now(),
): number {
  const base = currentExpiresAt && currentExpiresAt > now ? currentExpiresAt : now;
  return addMonthsMs(base, months);
}

export function computeExpiryFromDays(
  days: number,
  currentExpiresAt?: number | null,
  now = Date.now(),
): number {
  const base = currentExpiresAt && currentExpiresAt > now ? currentExpiresAt : now;
  return addDaysMs(base, days);
}

export function effectivePlanId(input: {
  plan?: PlanId | string | null;
  planExpiresAt?: number | null;
  planUpdatedAt?: number | null;
  now?: number;
}): PlanId {
  const now = input.now ?? Date.now();
  const plan =
    input.plan === 'pro' || input.plan === 'max' || input.plan === 'free' ? input.plan : 'free';
  if (plan === 'free') return 'free';

  if (typeof input.planExpiresAt === 'number' && input.planExpiresAt > 0) {
    return now < input.planExpiresAt ? plan : 'free';
  }

  const start = input.planUpdatedAt || 0;
  if (start > 0 && now < start + 30 * 24 * 60 * 60 * 1000) return plan;
  return 'free';
}

export function formatCountdown(msLeft: number): string {
  if (msLeft <= 0) return 'истёк';
  const sec = Math.floor(msLeft / 1000);
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (d > 0) return `${d}д ${h}ч ${m}м`;
  if (h > 0) return `${h}ч ${m}м ${s}с`;
  if (m > 0) return `${m}м ${s}с`;
  return `${s}с`;
}

export function todayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatLimit(plan: PlanDef): string {
  if (plan.creditsPerDay == null) return 'Без лимита кредитов';
  return `${plan.creditsPerDay} кр./сутки`;
}
