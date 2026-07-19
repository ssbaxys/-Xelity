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
  purchaseActionFor,
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
        'Тарифы Xelity: Free, Pro и Max. Дневные кредиты для Xlaude Mini/Pro K1 и K2.',
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
  const [totalKey, setTotalKey] = useState(0);

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
    const action = purchaseActionFor(planId, plan);
    if (action === 'blocked') {
      setError(
        `У вас уже ${current.name}. Можно только продлить текущий тариф или перейти на более высокий.`,
      );
      return;
    }
    if (!user) {
      setAuthMode('login');
      setAuthOpen(true);
      return;
    }
    setMonths(1);
    setTotalKey((k) => k + 1);
    setCheckoutPlan(plan);
    setCardholder(user.displayName || '');
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !checkoutPlan) return;
    setError(null);
    if (purchaseActionFor(planId, checkoutPlan) === 'blocked') {
      setError(
        `Нельзя оформить ${PLANS[checkoutPlan].name}: у вас уже более высокий тариф ${current.name}. Только продление.`,
      );
      return;
    }
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

  const history = useMemo(
    () => payments.filter((p) => p.status !== 'pending').slice(0, 12),
    [payments],
  );

  return (
    <div className="page-enter min-h-screen bg-paper text-ink">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="pricing-hero mb-8 flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link to="/" className="ui-press text-sm text-slate transition hover:text-ink">
              ← На главную
            </Link>
            <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Тарифы
            </h1>
            <p className="mt-2 max-w-xl text-sm text-slate">
              Free, Pro и Max — дневные кредиты и лимит токенов. Оплата на 1 / 3 / 12 месяцев.
            </p>
          </div>
          <Link
            to="/chat"
            className="ui-press rounded-lg bg-signal px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
          >
            В чат
          </Link>
        </div>

        {!loading && (
          <p className="pricing-status mb-6 text-sm text-slate">
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
          <div className="pricing-alert mb-6 rounded-xl border border-signal/30 bg-signal/10 px-4 py-3 text-sm">
            {okMsg}
          </div>
        )}
        {error && !checkoutPlan && (
          <div className="pricing-alert mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          {PLAN_ORDER.map((id, cardIndex) => {
            const p = PLANS[id];
            const active = id === planId;
            const action = purchaseActionFor(planId, id);
            const blocked = action === 'blocked';
            const btnLabel =
              id === 'free'
                ? 'Базовый'
                : action === 'renew'
                  ? 'Продлить'
                  : action === 'upgrade'
                    ? 'Улучшить'
                    : action === 'blocked'
                      ? 'Недоступно'
                      : 'Оплатить';
            return (
              <div
                key={id}
                className={`pricing-card flex flex-col rounded-2xl border p-5 ${
                  active
                    ? 'is-active border-signal/50 bg-elevated'
                    : blocked
                      ? 'is-blocked border-line bg-elevated/40 opacity-70'
                      : 'border-line bg-elevated/60'
                }`}
                style={{ animationDelay: `${120 + cardIndex * 90}ms` }}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="font-display text-xl font-bold">{p.name}</h2>
                  {active && (
                    <span className="pricing-badge rounded-md bg-signal/15 px-2 py-0.5 text-[11px] font-medium text-signal">
                      Активен
                    </span>
                  )}
                </div>
                <p className="mt-1 text-2xl font-semibold tracking-tight">{p.priceLabel}</p>
                {id !== 'free' && (
                  <div className="mt-2 space-y-1 text-[12px] text-slate">
                    {BILLING_PERIODS.map((bp, i) => (
                      <p
                        key={bp.months}
                        className="pricing-feature"
                        style={{ animationDelay: `${220 + cardIndex * 90 + i * 50}ms` }}
                      >
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
                <p
                  className="pricing-feature mt-2 text-sm text-slate"
                  style={{ animationDelay: `${280 + cardIndex * 90}ms` }}
                >
                  {p.blurb}
                </p>
                {blocked && id !== 'free' && (
                  <p
                    className="pricing-feature mt-2 text-[12px] text-slate"
                    style={{ animationDelay: `${320 + cardIndex * 90}ms` }}
                  >
                    У вас уже {current.name} — доступно только продление текущего тарифа
                    {planId !== 'max' ? ' или переход выше' : ''}.
                  </p>
                )}
                <ul className="mt-4 flex-1 space-y-2 text-sm text-slate">
                  {p.features.map((f, fi) => (
                    <li
                      key={f}
                      className="pricing-feature flex gap-2"
                      style={{ animationDelay: `${340 + cardIndex * 90 + fi * 55}ms` }}
                    >
                      <span className="text-signal">✓</span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  disabled={id === 'free' || blocked}
                  onClick={() => startCheckout(id)}
                  className="ui-press mt-5 rounded-lg bg-signal px-3 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {btnLabel}
                </button>
              </div>
            );
          })}
        </div>

        {pending.length > 0 && (
          <section className="pricing-section mt-10" style={{ animationDelay: '0.45s' }}>
            <h3 className="mb-3 text-sm font-semibold tracking-wide text-ink">
              Ожидают решения
              <span className="pricing-badge ml-2 rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[11px] font-medium text-amber-600">
                {pending.length}
              </span>
            </h3>
            <ul className="space-y-2.5">
              {pending.map((p, i) => (
                <li
                  key={p.id}
                  className="pricing-row flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/5 px-4 py-3.5 hover:border-amber-500/40"
                  style={{ animationDelay: `${480 + i * 55}ms` }}
                >
                  <div className="min-w-0">
                    <p className="font-medium text-ink">
                      {PLANS[p.plan].name}
                      <span className="ml-1.5 text-sm font-normal text-slate">
                        · {p.months || 1} мес. · {formatPriceRub(p.amount)}
                      </span>
                    </p>
                    <p className="mt-0.5 font-mono text-[12px] text-slate">
                      •••• {p.cardLast4}
                      <span className="mx-1.5 text-line">·</span>
                      {new Date(p.createdAt).toLocaleString('ru-RU')}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-medium text-amber-700">
                    В обработке
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {history.length > 0 && (
          <section className="pricing-section mt-8" style={{ animationDelay: '0.55s' }}>
            <h3 className="mb-3 text-sm font-semibold tracking-wide text-ink">История покупок</h3>
            <ul className="space-y-2">
              {history.map((p, i) => {
                const ok = p.status === 'succeeded';
                return (
                  <li
                    key={p.id}
                    className="pricing-row group flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-elevated px-4 py-3.5 hover:border-signal/30 hover:shadow-md hover:shadow-black/5"
                    style={{ animationDelay: `${560 + i * 50}ms` }}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[12px] font-bold transition group-hover:scale-105 ${
                          ok
                            ? 'bg-emerald-500/15 text-emerald-600'
                            : 'bg-red-500/10 text-red-400'
                        }`}
                      >
                        {PLANS[p.plan].name.slice(0, 1)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink">
                          {PLANS[p.plan].name}
                          <span className="ml-1.5 text-sm font-normal text-slate">
                            · {p.months || 1} мес. · {formatPriceRub(p.amount)}
                          </span>
                        </p>
                        <p className="mt-0.5 font-mono text-[12px] text-slate">
                          •••• {p.cardLast4}
                          <span className="mx-1.5 opacity-40">·</span>
                          {new Date(p.createdAt).toLocaleString('ru-RU')}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                        ok
                          ? 'bg-emerald-500/15 text-emerald-700'
                          : 'bg-red-500/10 text-red-500'
                      }`}
                    >
                      {paymentStatusLabel(p.status)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}
      </div>

      {checkoutPlan && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <button
            type="button"
            className="ui-backdrop absolute inset-0 bg-black/60"
            aria-label="Закрыть"
            onClick={() => setCheckoutPlan(null)}
          />
          <form
            onSubmit={onSubmit}
            className="ui-sheet relative z-10 w-full max-w-md rounded-2xl border border-line bg-elevated p-5 shadow-2xl"
          >
            {(() => {
              const checkoutAction = purchaseActionFor(planId, checkoutPlan);
              return (
                <div className="pricing-field" style={{ animationDelay: '40ms' }}>
                  <h3 className="font-display text-lg font-bold">
                    {checkoutAction === 'renew'
                      ? 'Продление'
                      : checkoutAction === 'upgrade'
                        ? 'Улучшение'
                        : 'Оплата'}{' '}
                    · {PLANS[checkoutPlan].name}
                  </h3>
                  <p className="mt-1 text-sm text-slate">
                    {checkoutAction === 'renew'
                      ? 'Срок добавится к текущей подписке. Выберите период и карту.'
                      : 'Выберите срок и заполните данные карты.'}
                  </p>
                </div>
              );
            })()}

            <div className="mt-4 grid grid-cols-3 gap-2">
              {BILLING_PERIODS.map((bp, i) => {
                const price = priceForPeriod(checkoutPlan, bp.months);
                const selected = months === bp.months;
                return (
                  <button
                    key={bp.months}
                    type="button"
                    onClick={() => {
                      setMonths(bp.months);
                      setTotalKey((k) => k + 1);
                    }}
                    className={`pricing-period ui-press rounded-xl border px-2 py-2.5 text-center ${
                      selected
                        ? 'is-selected border-signal bg-signal/10 ring-1 ring-signal/40'
                        : 'border-line hover:border-signal/40'
                    }`}
                    style={{ animationDelay: `${80 + i * 60}ms` }}
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

            <p key={totalKey} className="pricing-total mt-3 text-sm font-semibold">
              Итого: {formatPriceRub(checkoutTotal)} · {months} мес.
            </p>

            <div className="mt-4 space-y-3">
              <label
                className="pricing-field block text-xs text-slate"
                style={{ animationDelay: '160ms' }}
              >
                Имя на карте
                <input
                  value={cardholder}
                  onChange={(e) => setCardholder(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm text-ink outline-none transition focus:border-signal"
                />
              </label>
              <label
                className="pricing-field block text-xs text-slate"
                style={{ animationDelay: '210ms' }}
              >
                Номер карты
                <div className="relative mt-1">
                  <span className="pointer-events-none absolute left-2 top-1/2 z-[1] -translate-y-1/2 text-slate transition-transform duration-300">
                    <CardBrandLogo brand={cardBrand} className="h-5 w-8" />
                  </span>
                  <input
                    value={cardNumber}
                    onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                    inputMode="numeric"
                    autoComplete="cc-number"
                    placeholder="2200 0000 0000 0000"
                    className={`w-full rounded-lg border border-line bg-paper py-2.5 pr-3 font-mono text-sm text-ink outline-none transition focus:border-signal ${
                      cardBrand === 'mir' ? 'pl-[5.75rem]' : 'pl-12'
                    }`}
                  />
                </div>
                {cardBrand !== 'unknown' && (
                  <span className="pricing-badge mt-1 block text-[11px] text-slate">
                    {cardBrandLabel(cardBrand)}
                  </span>
                )}
              </label>
              <div
                className="pricing-field grid grid-cols-2 gap-3"
                style={{ animationDelay: '260ms' }}
              >
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
                    className={`mt-1 w-full rounded-lg border bg-paper px-3 py-2 font-mono text-sm text-ink outline-none transition ${
                      !expiryCheck.incomplete && !expiryCheck.ok
                        ? 'border-red-500/60 focus:border-red-400'
                        : expiryCheck.ok
                          ? 'border-emerald-500/40 focus:border-signal'
                          : 'border-line focus:border-signal'
                    }`}
                  />
                  {!expiryCheck.incomplete && expiryCheck.message && (
                    <span className="pricing-alert mt-1 block text-[11px] text-red-400">
                      {expiryCheck.message}
                    </span>
                  )}
                  {expiryCheck.ok && (
                    <span className="pricing-alert mt-1 block text-[11px] text-emerald-400/90">
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
                    className="mt-1 w-full rounded-lg border border-line bg-paper px-3 py-2 font-mono text-sm text-ink outline-none transition focus:border-signal"
                  />
                </label>
              </div>
            </div>
            {error && (
              <p className="pricing-alert mt-3 text-sm text-red-400">{error}</p>
            )}
            <div
              className="pricing-field mt-5 flex gap-2"
              style={{ animationDelay: '320ms' }}
            >
              <button
                type="button"
                onClick={() => setCheckoutPlan(null)}
                className="ui-press flex-1 rounded-lg border border-line px-3 py-2 text-sm"
              >
                Отмена
              </button>
              <button
                type="submit"
                disabled={
                  submitting ||
                  (!expiryCheck.incomplete && !expiryCheck.ok)
                }
                className="ui-press flex-1 rounded-lg bg-signal px-3 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
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
