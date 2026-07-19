import { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  createApiKey,
  fetchApiKeys,
  fetchBilling,
  revokeApiKey,
  type BillingInfo,
} from '../lib/accountApi';
import type { ApiKeyMeta } from '../lib/apiTypes';
import { formatUsd, formatUsdRatePer1M } from '../lib/apiPricing';
import { IconBrain, IconCopy, IconPlus, IconTrash } from '../components/icons';

export default function ApiCabinetPage() {
  const { user, loading } = useAuth();
  const [billing, setBilling] = useState<BillingInfo | null>(null);
  const [keys, setKeys] = useState<ApiKeyMeta[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secretOnce, setSecretOnce] = useState<string | null>(null);
  const [name, setName] = useState('Production');

  const reload = useCallback(async () => {
    const [b, k] = await Promise.all([fetchBilling(), fetchApiKeys()]);
    setBilling(b);
    setKeys(k.keys.filter((x) => !x.revokedAt));
  }, []);

  useEffect(() => {
    if (!user) return;
    setBusy(true);
    setError(null);
    void reload()
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка загрузки'))
      .finally(() => setBusy(false));
  }, [user, reload]);

  if (loading) {
    return (
      <div className="page-enter min-h-screen bg-paper text-ink">
        <div className="mx-auto max-w-3xl px-6 py-20 text-slate">Загрузка…</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/chat" replace />;

  const apiHost =
    (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ||
    'https://api.xelity.ru';

  return (
    <div className="page-enter min-h-screen bg-paper text-ink">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mb-8 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-signal/15 text-signal">
              <IconBrain className="h-6 w-6" />
            </span>
            <div>
              <Link to="/chat" className="ui-press text-sm text-slate transition hover:text-ink">
                ← В чат
              </Link>
              <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.14em] text-signal">
                Личный кабинет
              </p>
              <h1 className="font-display text-3xl font-bold tracking-tight">API Xelity</h1>
              <p className="mt-1 text-sm text-slate">
                Ключи, виртуальные USD, Xelity Search и Xelity Weather
              </p>
            </div>
          </div>
          <Link
            to="/api"
            className="ui-press rounded-lg border border-line px-3 py-2 text-xs font-semibold text-slate transition hover:border-signal/40 hover:text-ink"
          >
            Документация
          </Link>
        </div>

        {error && (
          <p className="mb-4 rounded-lg border border-signal/35 bg-signal/10 px-3 py-2 text-sm text-[#e57373]">
            {error}
          </p>
        )}

        <section className="mb-6 rounded-2xl border border-line bg-elevated p-5">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate/80">Баланс</p>
          <p className="mt-1 font-display text-3xl font-bold">
            {billing ? formatUsd(billing.usdBalance) : '—'}
          </p>
          <p className="mt-1 text-xs text-slate">
            Chat — по токенам (вход + выход). Search / Weather — фикс за вызов. Суммы вида{' '}
            {formatUsd(1)}.
          </p>
          {billing && (
            <ul className="mt-4 grid gap-2 text-xs text-slate sm:grid-cols-2">
              {(
                [
                  ['Mini K1', 'xlaude-mini-k1'],
                  ['Pro K1', 'xlaude-pro-k1'],
                  ['Mini K2', 'xlaude-mini-k2'],
                  ['Pro K2', 'xlaude-pro-k2'],
                ] as const
              ).map(([label, id]) => {
                const r = billing.pricing.chatPer1M[id];
                return (
                  <li key={id}>
                    {label} — in {formatUsdRatePer1M(r?.input ?? 0)}, out{' '}
                    {formatUsdRatePer1M(r?.output ?? 0)}
                  </li>
                );
              })}
              <li>Xelity Search — {formatUsd(billing.pricing.search)}</li>
              <li>Xelity Weather — {formatUsd(billing.pricing.weather)}</li>
            </ul>
          )}
        </section>

        <section className="mb-6 rounded-2xl border border-line bg-elevated p-5">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-sm font-semibold">API-ключи</h2>
            <div className="flex items-center gap-2">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-lg border border-line bg-mist px-2.5 py-1.5 text-xs text-ink"
                placeholder="Название"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  setError(null);
                  setSecretOnce(null);
                  void createApiKey(name || 'Default')
                    .then((r) => {
                      setSecretOnce(r.secret);
                      return reload();
                    })
                    .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка'))
                    .finally(() => setBusy(false));
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-signal px-3 py-1.5 text-xs font-semibold text-white"
              >
                <IconPlus className="h-3.5 w-3.5" />
                Создать
              </button>
            </div>
          </div>

          {secretOnce && (
            <div className="mb-3 rounded-lg border border-[rgba(46,125,50,0.35)] bg-[rgba(46,125,50,0.1)] px-3 py-2">
              <p className="text-[11px] text-[#81c784]">Скопируйте ключ — больше не покажем</p>
              <div className="mt-1 flex items-center gap-2">
                <code className="min-w-0 flex-1 break-all font-mono text-[12px] text-ink">
                  {secretOnce}
                </code>
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line"
                  onClick={() => void navigator.clipboard.writeText(secretOnce)}
                  aria-label="Копировать"
                >
                  <IconCopy className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          <ul className="space-y-2">
            {keys.map((k) => (
              <li
                key={k.id}
                className="flex items-center gap-2 rounded-lg border border-line px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-ink">{k.name}</p>
                  <p className="font-mono text-[11px] text-slate/70">
                    {k.prefix}… · {new Date(k.createdAt).toLocaleString('ru-RU')}
                  </p>
                </div>
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#e57373] hover:bg-signal/10"
                  aria-label="Отозвать"
                  onClick={() => {
                    if (!confirm('Отозвать ключ?')) return;
                    setBusy(true);
                    void revokeApiKey(k.id)
                      .then(reload)
                      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка'))
                      .finally(() => setBusy(false));
                  }}
                >
                  <IconTrash className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
            {!keys.length && !busy && (
              <p className="text-xs text-slate/70">Ключей пока нет — создайте первый.</p>
            )}
          </ul>
        </section>

        <section className="rounded-2xl border border-line bg-elevated p-5 text-sm text-slate">
          <h2 className="mb-2 text-sm font-semibold text-ink">Эндпоинты</h2>
          <ul className="space-y-1.5 font-mono text-[11px] leading-relaxed">
            <li>
              <span className="text-[#81c784]">POST</span> {apiHost}/v1/chat/completions{' '}
              <span className="text-slate/60">· OpenAI</span>
            </li>
            <li>
              <span className="text-[#81c784]">POST</span> {apiHost}/v1/messages{' '}
              <span className="text-slate/60">· Anthropic</span>
            </li>
            <li>
              <span className="text-[#81c784]">GET</span> {apiHost}/v1/models
            </li>
            <li>
              <span className="text-[#81c784]">POST</span> {apiHost}/v1/search{' '}
              <span className="text-slate/60">· Xelity Search</span>
            </li>
            <li>
              <span className="text-[#81c784]">POST</span> {apiHost}/v1/weather{' '}
              <span className="text-slate/60">· Xelity Weather</span>
            </li>
          </ul>
          <p className="mt-3 text-xs">
            Заголовок: <code className="text-ink">Authorization: Bearer xel_…</code>
          </p>
        </section>
      </div>
    </div>
  );
}
