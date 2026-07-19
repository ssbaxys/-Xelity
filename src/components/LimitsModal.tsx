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
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const limit = plan.creditsPerDay;
  const used = Math.max(0, usedToday);
  const remaining = limit == null ? null : Math.max(0, limit - used);
  const pct =
    limit == null || limit <= 0 ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const exhausted = remaining === 0;
  const low = remaining != null && remaining > 0 && pct >= 14;
  const model = MODELS.find((m) => m.id === modelId);
  const canAffordNext = remaining == null || remaining >= answerCost;

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
        className="ui-sheet relative z-10 flex max-h-[min(90dvh,36rem)] w-full max-w-[22rem] flex-col overflow-hidden rounded-2xl border border-[var(--c-border-strong)] bg-[var(--c-panel)] shadow-2xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[var(--c-border)] px-4 py-3.5">
          <div className="min-w-0">
            <h2 id="limits-title" className="text-[15px] font-semibold text-[var(--c-text)]">
              Лимиты
            </h2>
            <p className="mt-0.5 truncate text-[12px] text-[var(--c-muted)]">
              {plan.name} · {formatLimit(plan)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--c-faint)] transition hover:bg-[var(--c-hover)] hover:text-[var(--c-text)]"
            aria-label="Закрыть"
          >
            <IconClose className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4">
          {limit != null ? (
            <div className="space-y-2.5">
              <div className="flex items-end justify-between gap-2">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-[var(--c-faint)]">
                    Сегодня
                  </p>
                  <p
                    className={`mt-0.5 text-[22px] font-semibold tabular-nums leading-none ${
                      exhausted ? 'text-[#e57373]' : 'text-[var(--c-text)]'
                    }`}
                  >
                    {remaining}
                    <span className="text-[14px] font-normal text-[var(--c-muted)]">
                      {' '}
                      / {limit} кр.
                    </span>
                  </p>
                </div>
                <p className="text-[11px] tabular-nums text-[var(--c-faint)]">
                  использовано {used}
                </p>
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-[var(--c-soft)]"
                role="progressbar"
                aria-valuenow={used}
                aria-valuemin={0}
                aria-valuemax={limit}
                aria-label="Использование кредитов"
              >
                <div
                  className={`h-full rounded-full transition-[width] duration-500 ease-out ${
                    exhausted ? 'bg-[#e57373]' : low ? 'bg-[#ef9a9a]' : 'bg-[#c62828]'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-[12px] text-[var(--c-muted)]">
                {exhausted
                  ? 'Лимит на сегодня исчерпан. Сброс в 00:00 или смена тарифа.'
                  : !canAffordNext
                    ? `Для следующего ответа нужно ${answerCost} кр., осталось ${remaining}.`
                    : `Осталось ${remaining} кр. до сброса.`}
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-soft)]/70 px-3 py-3">
              <p className="text-[13px] font-medium text-[var(--c-text)]">Без дневного потолка</p>
              <p className="mt-1 text-[12px] text-[var(--c-muted)]">
                Сегодня использовано {used} кр.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-soft)]/50 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wide text-[var(--c-faint)]">
                След. ответ
              </p>
              <p className="mt-1 text-[14px] font-semibold tabular-nums text-[var(--c-text)]">
                −{answerCost} кр.
              </p>
              <p className="mt-0.5 truncate text-[11px] text-[var(--c-faint)]">
                {model ? `${model.tab}${reasoning ? ' · мысли' : ''}` : 'модель'}
              </p>
            </div>
            <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-soft)]/50 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-wide text-[var(--c-faint)]">Сброс</p>
              <p className="mt-1 text-[14px] font-semibold tabular-nums text-[var(--c-text)]">
                {formatCountdown(Math.max(0, resetLeft))}
              </p>
              <p className="mt-0.5 text-[11px] text-[var(--c-faint)]">каждый день 00:00</p>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--c-border)] bg-[var(--c-soft)]/50 px-3 py-2.5">
            <p className="text-[10px] uppercase tracking-wide text-[var(--c-faint)]">Подписка</p>
            {planExpiresAt ? (
              <>
                <p className="mt-1 text-[13px] font-medium text-[var(--c-text)]">
                  <PlanCountdown expiresAt={planExpiresAt} prefix="осталось" />
                </p>
                <p className="mt-0.5 text-[11px] text-[var(--c-faint)]">
                  до {new Date(planExpiresAt).toLocaleString('ru-RU')}
                </p>
              </>
            ) : plan.id === 'free' ? (
              <p className="mt-1 text-[13px] text-[var(--c-muted)]">Бесплатный тариф без срока</p>
            ) : (
              <p className="mt-1 text-[13px] text-[var(--c-muted)]">Срок не задан</p>
            )}
          </div>

          <div>
            <p className="mb-1.5 text-[10px] uppercase tracking-wide text-[var(--c-faint)]">
              Стоимость моделей
            </p>
            <ul className="divide-y divide-[var(--c-border)] rounded-xl border border-[var(--c-border)] overflow-hidden">
              {MODELS.map((m) => {
                const active = m.id === modelId;
                return (
                  <li
                    key={m.id}
                    className={`flex items-center justify-between gap-2 px-3 py-2 text-[12px] ${
                      active ? 'bg-[var(--c-soft)]' : ''
                    }`}
                  >
                    <span className={active ? 'font-medium text-[var(--c-text)]' : 'text-[var(--c-muted)]'}>
                      {m.name}
                    </span>
                    <span className="shrink-0 tabular-nums text-[var(--c-faint)]">
                      {creditCostForRequest(m.id, false)}/{creditCostForRequest(m.id, true)} кр.
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-1.5 text-[10px] text-[var(--c-faint)]">обычный / с рассуждениями</p>
          </div>
        </div>

        <div className="flex shrink-0 gap-2 border-t border-[var(--c-border)] px-4 py-3">
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
            {exhausted || !canAffordNext ? 'Повысить тариф' : 'Тарифы'}
          </Link>
        </div>
      </div>
    </div>,
    document.body,
  );
}
