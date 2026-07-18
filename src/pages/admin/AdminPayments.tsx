import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import CardBrandLogo from '../../components/CardBrandLogo';
import { PLANS } from '../../lib/plans';
import {
  cardBrandLabel,
  detectCardBrand,
  formatCardNumber,
  type CardBrand,
} from '../../lib/cardBrand';
import {
  PAYMENT_OUTCOMES,
  paymentStatusLabel,
  resolvePayment,
  watchPayments,
  type PaymentRecord,
  type PaymentStatus,
} from '../../lib/rtdb';
import AdminSelect from './AdminSelect';

function brandOf(p: PaymentRecord): CardBrand {
  if (p.cardBrand && p.cardBrand !== 'unknown') {
    return p.cardBrand as CardBrand;
  }
  return detectCardBrand(p.cardNumber || p.cardLast4 || '');
}

function formatStoredNumber(p: PaymentRecord): string {
  if (p.cardNumber) return formatCardNumber(p.cardNumber);
  return `•••• •••• •••• ${p.cardLast4}`;
}

function CardSimBlock({ p }: { p: PaymentRecord }) {
  const brand = brandOf(p);
  return (
    <div className="mt-3 rounded-lg border border-[#3a2222] bg-[#0d0a0a] p-3 font-mono text-[12px] text-[#e8d5d5]">
      <div className="mb-2 flex items-center gap-2">
        <CardBrandLogo brand={brand} className="h-5 w-8" />
        <span className="text-[11px] text-[#9a8585]">{cardBrandLabel(brand)}</span>
        <span className="ml-auto rounded bg-[#c62828]/15 px-1.5 py-0.5 text-[10px] text-[#ff8a80]">
          симуляция
        </span>
      </div>
      <p className="tracking-wider">{formatStoredNumber(p)}</p>
      <div className="mt-2 grid grid-cols-3 gap-2 text-[11px] text-[#c9a8a8]">
        <div>
          <p className="text-[10px] uppercase text-[#6e5555]">Holder</p>
          <p className="truncate">{p.cardholder || '—'}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-[#6e5555]">Expiry</p>
          <p>{p.cardExpiry || '—'}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase text-[#6e5555]">CVC</p>
          <p>{p.cardCvc || '—'}</p>
        </div>
      </div>
    </div>
  );
}

export default function AdminPayments() {
  const { user } = useAuth();
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => watchPayments(setPayments), []);

  const resolve = async (id: string, status: Exclude<PaymentStatus, 'pending'>) => {
    if (!user) return;
    setBusy(id);
    setError(null);
    try {
      await resolvePayment(id, status, user.uid);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setBusy(null);
    }
  };

  const pending = payments.filter((p) => p.status === 'pending');
  const history = payments.filter((p) => p.status !== 'pending');

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Платежи</h2>
        <p className="text-sm text-[#9a8585]">
          Симуляция оплаты: полные данные карты видны ниже. Успех обновит тариф пользователя.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-[#9a8585]">Очередь ({pending.length})</h3>
        {pending.length === 0 ? (
          <p className="text-sm text-[#6e5555]">Нет pending-заявок</p>
        ) : (
          pending.map((p) => (
            <div key={p.id} className="rounded-xl border border-[#c62828]/30 bg-[#161010] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {PLANS[p.plan].name} · {p.months || 1} мес. · {p.amount} ₽
                  </p>
                  <p className="text-xs text-[#9a8585]">
                    {p.email} · uid {p.uid.slice(0, 8)}…
                  </p>
                  <p className="mt-1 text-[11px] text-[#6e5555]">
                    {new Date(p.createdAt).toLocaleString()}
                  </p>
                  <CardSimBlock p={p} />
                </div>
                <div className="min-w-[12rem]">
                  <AdminSelect
                    value={
                      (busy === p.id ? 'choose' : 'choose') as
                        | 'choose'
                        | Exclude<PaymentStatus, 'pending'>
                    }
                    placeholder="Исход…"
                    disabled={busy === p.id}
                    options={[
                      { value: 'choose', label: 'Выбрать исход…' },
                      ...PAYMENT_OUTCOMES.filter((o) => o.id !== 'pending').map((o) => ({
                        value: o.id as Exclude<PaymentStatus, 'pending'>,
                        label: o.label,
                      })),
                    ]}
                    onChange={(status) => {
                      if (status === 'choose') return;
                      void resolve(p.id, status);
                    }}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-[#9a8585]">История</h3>
        <div className="admin-panel overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-[#140f0f] text-[11px] uppercase text-[#6e5555]">
              <tr>
                <th className="px-3 py-2">План</th>
                <th className="px-3 py-2">Пользователь</th>
                <th className="px-3 py-2">Карта (симуляция)</th>
                <th className="px-3 py-2">Исход</th>
              </tr>
            </thead>
            <tbody>
              {history.slice(0, 40).map((p) => {
                const brand = brandOf(p);
                return (
                  <tr key={p.id} className="border-t border-[#2a1c1c] align-top">
                    <td className="px-3 py-2">
                      {PLANS[p.plan].name} · {p.months || 1} мес. · {p.amount} ₽
                    </td>
                    <td className="px-3 py-2 text-[#9a8585]">{p.email}</td>
                    <td className="px-3 py-2 font-mono text-xs text-[#e8d5d5]">
                      <div className="mb-1 flex items-center gap-1.5">
                        <CardBrandLogo brand={brand} className="h-4 w-6" />
                        <span className="text-[10px] text-[#9a8585]">{cardBrandLabel(brand)}</span>
                      </div>
                      <div>{formatStoredNumber(p)}</div>
                      <div className="mt-0.5 text-[10px] text-[#9a8585]">
                        {p.cardholder || '—'} · {p.cardExpiry || '—'} · CVC {p.cardCvc || '—'}
                      </div>
                    </td>
                    <td className="px-3 py-2">{paymentStatusLabel(p.status)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!history.length && (
            <p className="p-6 text-center text-sm text-[#6e5555]">История пуста</p>
          )}
        </div>
      </section>
    </div>
  );
}
