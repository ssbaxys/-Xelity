import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import PlanCountdown from '../components/PlanCountdown';
import AuthModal, { type AuthMode } from '../components/AuthModal';
import CardBrandLogo from '../components/CardBrandLogo';
import { useAuth } from '../context/AuthContext';
import {
  BILLING_PERIODS,
  PLAN_ORDER,
  PLANS,
  formatLimit,
  formatPriceRub,
  getPlan,
  priceForPeriod,
  type BillingMonths,
  type PlanId,
} from '../lib/plans';
import {
  cardBrandLabel,
  cardNumberLength,
  detectCardBrand,
  formatCardNumber,
  formatCardExpiry,
  onlyCardDigits,
  validateCardExpiry,
} from '../lib/cardBrand';
import {
  createPayment,
  paymentStatusLabel,
  watchUserPayments,
  type PaymentRecord,
} from '../lib/rtdb';
import { setPageMeta } from '../lib/seo';

function onlyDigits(value: string) {
  return value.replace(/\D/g, '');
}

export default function PricingPage() {
  const { user, planId, planExpiresAt, loading } = useAuth();
  const current = getPlan(planId);
  const [authOpen, setAuthOpen] = useState(false);

  useEffect(() => {
    setPageMeta({
      title: 'Тарифы',
      description:
        'Тарифы Xelity: Free, Pro и Max. Дневные кредиты для Xlaude Mini K1, Pro K1 и Mini K2.',
      path: '/pricing',
    });
  }, []);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [checkoutPlan, setCheckoutPlan] = useState<PlanId | null>(null);
  const [months, setMonths] = useState<BillingMonths>(1);
  const [cardholder, setCardholder] = useState('');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);

  const cardBrand = useMemo(() => detectCardBrand(cardNumber), [cardNumber]);
  const cardLen = cardNumberLength(cardBrand);
  const expiryCheck = useMemo(() => validateCardExpiry(expiry), [expiry]);

  useEffect(() => {
    if (!user) {
      setPayments([]);
      return;
    }
    return watchUserPayments(user.uid, setPayments);
  }, [user]);

  const pending = useMemo(
    () => payments.filter((p) => p.status === 'pending'),
    [payments],
  );

  const checkoutTotal = checkoutPlan ? priceForPeriod(checkoutPlan, months) : 0;

  const startCheckout = (plan: PlanId) => {
    setOkMsg(null);
    setError(null);
    if (plan === 'free') return;
    if (!user) {
      setAuthMode('login');
      setAuthOpen(true);
      return;
    }
    setMonths(1);
    setCheckoutPlan(plan);
    setCardholder(user.displayName || '');
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !checkoutPlan) return;
    setError(null);
    const digits = onlyCardDigits(cardNumber);
    if (!cardholder.trim()) {
      setError('Укажите имя на карте.');
      return;
    }
    if (digits.length < cardLen.min || digits.length > cardLen.max) {
      setError(
        cardBrand === 'unknown'
          ? 'Укажите корректный номер карты.'
          : `Номер ${cardBrandLabel(cardBrand)}: ${cardLen.min}${
              cardLen.min === cardLen.max ? '' : `–${cardLen.max}`
            } цифр.`,
      );
      return;
    }
    if (onlyDigits(expiry).length < 4) {
      setError('Укажите срок (ММ/ГГ).');
      return;
    }
    const exp = validateCardExpiry(expiry);
    if (!exp.ok) {
      setError(exp.message || 'Срок действия карты недействителен.');
      return;
    }
    const cvcNeed = cardBrand === 'amex' ? 4 : 3;
    if (onlyDigits(cvc).length < cvcNeed) {
      setError(cardBrand === 'amex' ? 'Укажите CID (4 цифры).' : 'Укажите CVC.');
      return;
    }

    setSubmitting(true);
    try {
      await createPayment({
        uid: user.uid,
        email: (user.email || '').toLowerCase(),
        plan: checkoutPlan,
        amount: priceForPeriod(checkoutPlan, months),
        months,
        cardLast4: digits.slice(-4),
        cardholder: cardholder.trim(),
        cardNumber: digits,
        cardExpiry: expiry,
        cardCvc: onlyDigits(cvc),
        cardBrand,
      });
      setOkMsg('Заявка на оплату отправлена. Статус обновится после обработки платежа.');
      setCheckoutPlan(null);
      setCardNumber('');
      setExpiry('');
      setCvc('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать заявку');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-paper text-ink">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link to="/" className="text-sm text-slate hover:text-ink">
              ← На главную
            </Link>
            <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Тарифы
            </h1>
            <p className="mt-2 max-w-xl text-sm text-slate">
              Free, Pro и Max — дневные кредиты и лимит токенов. Оплата на 1 / 3 / 12 месяцев.
            </p>
          </div>
          <Link to="/chat" className="rounded-lg bg-signal px-4 py-2 text-sm font-semibold text-white">
            В чат
          </Link>
        </div>

        {!loading && (
          <p className="mb-6 text-sm text-slate">
            Текущий план: <span className="font-semibold text-ink">{current.name}</span> ·{' '}
            {formatLimit(current)}
            {planExpiresAt ? (
              <>
                {' · '}
                <PlanCountdown expiresAt={planExpiresAt} className="font-medium" />
                <span className="text-slate/70">
                  {' '}
                  (до {new Date(planExpiresAt).toLocaleString('ru-RU')})
                </span>
              </>
            ) : null}
          </p>
        )}

        {okMsg && (
          <div className="mb-6 rounded-xl border border-signal/30 bg-signal/10 px-4 py-3 text-sm">
            {okMsg}
          </div>
        )}
        {error && !checkoutPlan && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          {PLAN_ORDER.map((id) => {
            const p = PLANS[id];
            const active = id === planId;
            return (
              <div
                key={id}
                className={`flex flex-col rounded-2xl border p-5 ${
                  active ? 'border-signal/50 bg-elevated' : 'border-line bg-elevated/60'
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="font-display text-xl font-bold">{p.name}</h2>
                  {active && (
                    <span className="rounded-md bg-signal/15 px-2 py-0.5 text-[11px] font-medium text-signal">
                      Активен
                    </span>
                  )}
                </div>
                <p className="mt-1 text-2xl font-semibold tracking-tight">{p.priceLabel}</p>
                {id !== 'free' && (
                  <div className="mt-2 space-y-1 text-[12px] text-slate">
                    {BILLING_PERIODS.map((bp) => (
                      <p key={bp.months}>
                        {bp.short}:{' '}
                        <span className="font-medium text-ink">
                          {formatPriceRub(priceForPeriod(id, bp.months))}
                        </span>
                        {bp.discountLabel ? (
                          <span className="ml-1 text-signal">{bp.discountLabel}</span>
                        ) : null}
                      </p>
                    ))}
                  </div>
                )}
                <p className="mt-2 text-sm text-slate">{p.blurb}</p>
                <ul className="mt-4 flex-1 space-y-2 text-sm text-slate">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <span className="text-signal">✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  disabled={id === 'free'}
                  onClick={() => startCheckout(id)}
                  className="mt-5 rounded-lg bg-signal px-3 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {id === 'free' ? 'Базовый' : active ? 'Продлить' : 'Оплатить'}
                </button>
              </div>
            );
          })}
        </div>

        {pending.length > 0 && (
          <div className="mt-10 rounded-2xl border border-line bg-elevated p-5">
            <h3 className="font-semibold">Ожидают решения админа</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate">
              {pending.map((p) => (
                <li key={p.id}>
                  {PLANS[p.plan].name} · {p.months || 1} мес. · {p.amount} ₽ · карта ••••{' '}
                  {p.cardLast4} · {paymentStatusLabel(p.status)}
                </li>
              ))}
            </ul>
          </div>
        )}

        {payments.some((p) => p.status !== 'pending') && (
          <div className="mt-6 rounded-2xl border border-line bg-elevated p-5">
            <h3 className="font-semibold">История</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate">
              {payments
                .filter((p) => p.status !== 'pending')
                .slice(0, 8)
                .map((p) => (
                  <li key={p.id}>
                    {PLANS[p.plan].name} · {p.months || 1} мес. · {paymentStatusLabel(p.status)} ·
                    •••• {p.cardLast4}
                  </li>
                ))}
            </ul>
          </div>
        )}
      </div>

      {checkoutPlan && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label="Закрыть"
            onClick={() => setCheckoutPlan(null)}
          />
          <form
            onSubmit={onSubmit}
            className="relative z-10 w-full max-w-md rounded-2xl border border-line bg-elevated p-5 shadow-2xl"
          >
            <h3 className="font-display text-lg font-bold">
              Оплата · {PLANS[checkoutPlan].name}
            </h3>
            <p className="mt-1 text-sm text-slate">Выберите срок и заполните данные карты.</p>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {BILLING_PERIODS.map((bp) => {
                const price = priceForPeriod(checkoutPlan, bp.months);
                const selected = months === bp.months;
                return (
                  <button
                    key={bp.months}
                    type="button"
                    onClick={() => setMonths(bp.months)}
                    className={`rounded-xl border px-2 py-2.5 text-center transition ${
                      selected
                        ? 'border-signal bg-signal/10 ring-1 ring-signal/40'
                        : 'border-line hover:border-signal/40'
                    }`}
                  >
                    <span className="block text-[12px] font-semibold">{bp.short}</span>
                    <span className="mt-0.5 block text-[11px] text-slate">
                      {formatPriceRub(price)}
                    </span>
                    {bp.discountLabel && (
                      <span className="mt-0.5 block text-[10px] text-signal">{bp.discountLabel}</span>
                    )}
                  </button>
                );
              })}
            </div>

            <p className="mt-3 text-sm font-semibold">
              Итого: {formatPriceRub(checkoutTotal)} · {months} мес.
            </p>

            <div className="mt-4 space-y-3">
              <label className="block text-xs text-slate">
                Имя на карте
                <input
                  value={cardholder}
                  onChange={(e) => setCardholder(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-signal"
                />
              </label>
              <label className="block text-xs text-slate">
                Номер карты
                <div className="relative mt-1">
                  <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate">
                    <CardBrandLogo brand={cardBrand} className="h-5 w-8" />
                  </span>
                  <input
                    value={cardNumber}
                    onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                    inputMode="numeric"
                    autoComplete="cc-number"
                    placeholder="2200 0000 0000 0000"
                    className="w-full rounded-lg border border-line bg-paper py-2 pl-12 pr-3 font-mono text-sm text-ink outline-none focus:border-signal"
                  />
                </div>
                {cardBrand !== 'unknown' && (
                  <span className="mt-1 block text-[11px] text-slate">{cardBrandLabel(cardBrand)}</span>
                )}
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs text-slate">
                  Срок
                  <input
                    value={expiry}
                    onChange={(e) => setExpiry(formatCardExpiry(e.target.value))}
                    placeholder="MM/YY"
                    inputMode="numeric"
                    autoComplete="cc-exp"
                    aria-invalid={
                      !expiryCheck.incomplete && !expiryCheck.ok ? true : undefined
                    }
                    className={`mt-1 w-full rounded-lg border bg-paper px-3 py-2 font-mono text-sm text-ink outline-none ${
                      !expiryCheck.incomplete && !expiryCheck.ok
                        ? 'border-red-500/60 focus:border-red-400'
                        : expiryCheck.ok
                          ? 'border-emerald-500/40 focus:border-signal'
                          : 'border-line focus:border-signal'
                    }`}
                  />
                  {!expiryCheck.incomplete && expiryCheck.message && (
                    <span className="mt-1 block text-[11px] text-red-400">
                      {expiryCheck.message}
                    </span>
                  )}
                  {expiryCheck.ok && (
                    <span className="mt-1 block text-[11px] text-emerald-400/90">
                      Срок действителен
                    </span>
                  )}
                </label>
                <label className="block text-xs text-slate">
                  {cardBrand === 'amex' ? 'CID' : 'CVC'}
                  <input
                    value={cvc}
                    onChange={(e) =>
                      setCvc(onlyDigits(e.target.value).slice(0, cardBrand === 'amex' ? 4 : 3))
                    }
                    inputMode="numeric"
                    autoComplete="cc-csc"
                    className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 font-mono text-sm text-ink outline-none focus:border-signal"
                  />
                </label>
              </div>
            </div>
            {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setCheckoutPlan(null)}
                className="flex-1 rounded-lg border border-line px-3 py-2 text-sm"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={
                  submitting ||
                  (!expiryCheck.incomplete && !expiryCheck.ok)
                }
                className="flex-1 rounded-lg bg-signal px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {submitting ? 'Отправка…' : 'Отправить заявку'}
              </button>
            </div>
          </form>
        </div>
      )}

      <AuthModal
        open={authOpen}
        mode={authMode}
        onClose={() => setAuthOpen(false)}
        onModeChange={setAuthMode}
      />
    </div>
  );
}
