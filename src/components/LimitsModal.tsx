import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import {
  formatCountdown,
  formatLimit,
  nextCreditsResetAt,
  type PlanDef,
} from '../lib/plans';
import { MODELS, creditCostForRequest } from '../lib/models';
import PlanCountdown from './PlanCountdown';
import { IconClose } from './icons';

type Props = {
  open: boolean;
  onClose: () => void;
  plan: PlanDef;
  usedToday: number;
  answerCost: number;
  planExpiresAt: number | null;
  modelId?: string | null;
  reasoning?: boolean;
};

function LimitSlider({
  label,
  value,
  max,
  hint,
}: {
  label: string;
  value: number;
  max: number;
  hint?: string;
}) {
  const safeMax = Math.max(1, max);
  const clamped = Math.min(Math.max(0, value), safeMax);
  const pct = Math.round((clamped / safeMax) * 100);
  const low = pct >= 90;

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[12px] font-medium text-[var(--c-text)]">{label}</p>
        <p className={`text-[12px] tabular-nums ${low ? 'text-[#e57373]' : 'text-[var(--c-muted)]'}`}>
          {clamped} / {max}
          <span className="ml-1 text-[10px] text-[var(--c-faint)]">({pct}%)</span>
        </p>
      </div>
      <div className="relative h-2 overflow-hidden rounded-full bg-[var(--c-soft)]">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-out ${
            low ? 'bg-[#e57373]' : 'bg-[#c62828]'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <input
        type="range"
        min={0}
        max={safeMax}
        value={clamped}
        readOnly
        tabIndex={-1}
        aria-valuetext={`${clamped} из ${max}`}
        className="limits-range w-full"
      />
      {hint && <p className="text-[11px] text-[var(--c-faint)]">{hint}</p>}
    </div>
  );
}

export default function LimitsModal({
  open,
  onClose,
  plan,
  usedToday,
  answerCost,
  planExpiresAt,
  modelId,
  reasoning = false,
}: Props) {
  const [resetLeft, setResetLeft] = useState(() => nextCreditsResetAt() - Date.now());

  useEffect(() => {
    if (!open) return;
    const tick = () => setResetLeft(nextCreditsResetAt() - Date.now());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const limit = plan.creditsPerDay;
  const remaining = limit == null ? null : Math.max(0, limit - usedToday);
  const model = MODELS.find((m) => m.id === modelId);

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center p-3 sm:items-center sm:p-4">
      <button
        type="button"
        className="ui-backdrop absolute inset-0 bg-black/55"
        aria-label="Закрыть"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="limits-title"
        className="ui-sheet relative z-10 flex max-h-[min(92vh,640px)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-[var(--c-border-strong)] bg-[var(--c-panel)] shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--c-border)] px-4 py-3.5">
          <div>
            <h2 id="limits-title" className="text-[15px] font-semibold text-[var(--c-text)]">
              Лимиты
            </h2>
            <p className="mt-0.5 text-[12px] text-[var(--c-muted)]">
              {plan.name} · {formatLimit(plan)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--c-faint)] transition hover:bg-[var(--c-hover)] hover:text-[var(--c-text)]"
            aria-label="Закрыть"
          >
            <IconClose className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto px-4 py-4">
          {limit != null ? (
            <>
              <LimitSlider
                label="Кредиты сегодня"
                value={usedToday}
                max={limit}
                hint={
                  remaining === 0
                    ? 'Лимит на сегодня исчерпан — подождите сброса или смените тариф.'
                    : `Осталось ${remaining} кр. до сброса.`
                }
              />
              <LimitSlider
                label="Остаток на сегодня"
                value={remaining ?? 0}
                max={limit}
                hint={`${formatLimit(plan)} · использовано ${usedToday} кр.`}
              />
            </>
          ) : (
            <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-soft)] px-3 py-2.5 text-[12px] text-[var(--c-muted)]">
              Сегодня использовано {usedToday} кр. · без дневного потолка
            </div>
          )}

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-soft)]/60 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wider text-[var(--c-faint)]">Следующий ответ</p>
              <p className="mt-1 text-[13px] font-medium text-[var(--c-text)]">−{answerCost} кр.</p>
              <p className="mt-0.5 truncate text-[11px] text-[var(--c-faint)]">
                {model
                  ? `${model.name}${reasoning ? ' · рассуждения' : ''}`
                  : 'текущая модель'}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-soft)]/60 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wider text-[var(--c-faint)]">Сброс кредитов</p>
              <p className="mt-1 text-[13px] font-medium tabular-nums text-[var(--c-text)]">
                через {formatCountdown(Math.max(0, resetLeft))}
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--c-faint)]">каждый день в 00:00</p>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-soft)]/60 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wider text-[var(--c-faint)]">Подписка</p>
            {planExpiresAt ? (
              <>
                <p className="mt-1 text-[13px] font-medium text-[var(--c-text)]">
                  <PlanCountdown expiresAt={planExpiresAt} prefix="осталось" />
                </p>
                <p className="mt-0.5 text-[11px] text-[var(--c-faint)]">
                  до {new Date(planExpiresAt).toLocaleString('ru-RU')}
                </p>
              </>
            ) : (
              <p className="mt-1 text-[13px] text-[var(--c-muted)]">Бессрочный Free</p>
            )}
          </div>

          <div>
            <p className="mb-2 text-[11px] uppercase tracking-wider text-[var(--c-faint)]">
              Стоимость моделей
            </p>
            <ul className="space-y-1.5">
              {MODELS.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-[12px] text-[var(--c-muted)] hover:bg-[var(--c-hover)]"
                >
                  <span className="text-[var(--c-text)]">{m.name}</span>
                  <span className="tabular-nums text-[var(--c-faint)]">
                    {creditCostForRequest(m.id, false)} / {creditCostForRequest(m.id, true)} кр.
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-1.5 text-[10px] text-[var(--c-faint)]">обычный / с рассуждениями</p>
          </div>
        </div>

        <div className="flex gap-2 border-t border-[var(--c-border)] px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-[var(--c-border)] px-3 py-2.5 text-[13px] text-[var(--c-muted)] transition hover:bg-[var(--c-hover)] hover:text-[var(--c-text)]"
          >
            Закрыть
          </button>
          <Link
            to="/pricing"
            onClick={onClose}
            className="flex-1 rounded-xl bg-[#c62828] px-3 py-2.5 text-center text-[13px] font-semibold text-white transition hover:brightness-110"
          >
            Тарифы
          </Link>
        </div>
      </div>
    </div>,
    document.body,
  );
}
