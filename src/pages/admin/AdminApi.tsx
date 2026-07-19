import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  adminApiBalance,
  adminApiCreateKey,
  adminApiFreeze,
  adminApiLookup,
  adminApiOverview,
  adminApiRevokeAllKeys,
  adminApiRevokeKey,
  adminApiUser,
  type AdminApiClientRow,
  type AdminApiUserBundle,
} from '../../lib/adminApiClient';
import { formatUsd } from '../../lib/apiPricing';
import { IconCopy, IconPlus, IconTrash } from '../../components/icons';
import AdminSelect from './AdminSelect';

export default function AdminApi() {
  const [clients, setClients] = useState<AdminApiClientRow[]>([]);
  const [bundle, setBundle] = useState<AdminApiUserBundle | null>(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secretOnce, setSecretOnce] = useState<string | null>(null);
  const [keyName, setKeyName] = useState('Admin');
  const [balAction, setBalAction] = useState<'credit' | 'debit' | 'set'>('credit');
  const [balAmount, setBalAmount] = useState('10');
  const [balNote, setBalNote] = useState('');

  const loadOverview = useCallback(async () => {
    const r = await adminApiOverview();
    setClients(r.clients);
  }, []);

  useEffect(() => {
    setBusy(true);
    void loadOverview()
      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка'))
      .finally(() => setBusy(false));
  }, [loadOverview]);

  const openUser = async (uid: string) => {
    setBusy(true);
    setError(null);
    setSecretOnce(null);
    try {
      const b = await adminApiUser(uid);
      setBundle(b);
      setQuery(b.user.email || uid);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setBusy(false);
    }
  };

  const search = async () => {
    if (!query.trim()) return;
    setBusy(true);
    setError(null);
    setSecretOnce(null);
    try {
      const b = await adminApiLookup(query.trim());
      setBundle(b);
      await loadOverview();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка');
      setBundle(null);
    } finally {
      setBusy(false);
    }
  };

  const refreshBundle = async () => {
    if (!bundle) return;
    const b = await adminApiUser(bundle.user.uid);
    setBundle(b);
    await loadOverview();
  };

  const uid = bundle?.user.uid;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Клиентский API</h2>
        <p className="text-sm text-[var(--a-muted)]">
          Баланс USD, ключи <code className="text-[var(--a-strong)]">xel_…</code>, freeze, ledger —
          для любого клиента.
        </p>
      </div>

      {error && <div className="admin-error">{error}</div>}

      <section className="rounded-xl border border-[var(--a-border)] bg-[var(--a-elev)] p-4">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--a-faint)]">
          Найти клиента
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void search();
            }}
            placeholder="email, uid или имя"
            className="min-w-[220px] flex-1 rounded-lg border border-[var(--a-border)] bg-[var(--a-input)] px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={busy || !query.trim()}
            onClick={() => void search()}
            className="rounded-lg bg-[var(--admin-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            Открыть
          </button>
        </div>
      </section>

      {bundle && uid && (
        <section className="space-y-4 rounded-xl border border-[var(--a-border)] bg-[var(--a-elev)] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-[var(--a-text)]">
                {bundle.user.name || '—'}{' '}
                <span className="text-sm font-normal text-[var(--a-muted)]">
                  {bundle.user.email}
                </span>
              </p>
              <p className="mt-0.5 font-mono text-[11px] text-[var(--a-faint)]">{uid}</p>
              <Link
                to={`/admin/users/${uid}`}
                className="mt-1 inline-block text-[11px] text-[var(--a-accent-fg)] hover:underline"
              >
                Карточка пользователя →
              </Link>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase text-[var(--a-faint)]">Баланс</p>
              <p className="font-display text-2xl font-bold text-[var(--a-accent-fg)]">
                {formatUsd(bundle.usdBalance)}
              </p>
              {bundle.apiFrozen && (
                <p className="mt-1 text-[11px] font-semibold text-[var(--a-danger)]">API заморожен</p>
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-[var(--a-border)] p-3">
              <p className="mb-2 text-[11px] font-semibold uppercase text-[var(--a-faint)]">
                Баланс
              </p>
              <div className="mb-2">
                <AdminSelect
                  value={balAction}
                  options={[
                    { value: 'credit', label: 'Пополнить (+)' },
                    { value: 'debit', label: 'Списать (−)' },
                    { value: 'set', label: 'Установить =' },
                  ]}
                  onChange={(v) => setBalAction(v as 'credit' | 'debit' | 'set')}
                />
              </div>
              <input
                value={balAmount}
                onChange={(e) => setBalAmount(e.target.value)}
                type="number"
                min="0"
                step="0.01"
                className="mb-2 w-full rounded-lg border border-[var(--a-border)] bg-[var(--a-input)] px-2.5 py-1.5 text-sm"
                placeholder="Сумма USD"
              />
              <input
                value={balNote}
                onChange={(e) => setBalNote(e.target.value)}
                className="mb-2 w-full rounded-lg border border-[var(--a-border)] bg-[var(--a-input)] px-2.5 py-1.5 text-sm"
                placeholder="Комментарий в ledger"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  const amount = Number(balAmount);
                  if (!Number.isFinite(amount)) {
                    setError('Некорректная сумма');
                    return;
                  }
                  setBusy(true);
                  setError(null);
                  void adminApiBalance(uid, {
                    action: balAction,
                    amount,
                    note: balNote || undefined,
                  })
                    .then(refreshBundle)
                    .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка'))
                    .finally(() => setBusy(false));
                }}
                className="w-full rounded-lg border border-[var(--admin-accent)]/45 bg-[var(--admin-accent-soft)] px-3 py-2 text-xs font-semibold text-[var(--a-accent-fg)]"
              >
                Применить
              </button>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {[1, 5, 10, 25, 100].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="rounded-md border border-[var(--a-border)] px-2 py-1 text-[10px] text-[var(--a-muted)] hover:bg-[var(--a-hover)]"
                    onClick={() => {
                      setBalAction('credit');
                      setBalAmount(String(n));
                    }}
                  >
                    +${n}
                  </button>
                ))}
                <button
                  type="button"
                  className="rounded-md border border-[var(--a-border)] px-2 py-1 text-[10px] text-[var(--a-muted)] hover:bg-[var(--a-hover)]"
                  onClick={() => {
                    setBalAction('set');
                    setBalAmount('0');
                  }}
                >
                  = $0
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-[var(--a-border)] p-3">
              <p className="mb-2 text-[11px] font-semibold uppercase text-[var(--a-faint)]">
                Доступ API
              </p>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void adminApiFreeze(uid, !bundle.apiFrozen)
                    .then(refreshBundle)
                    .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка'))
                    .finally(() => setBusy(false));
                }}
                className={`mb-3 w-full rounded-lg border px-3 py-2 text-xs font-semibold ${
                  bundle.apiFrozen
                    ? 'border-[var(--a-ok-border)] bg-[var(--a-ok-soft)] text-[var(--a-ok)]'
                    : 'border-[var(--a-danger-border)] bg-[var(--a-danger-soft)] text-[var(--a-danger)]'
                }`}
              >
                {bundle.apiFrozen ? 'Разморозить API' : 'Заморозить API'}
              </button>
              <div className="mb-2 flex flex-wrap items-end gap-2">
                <input
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-[var(--a-border)] bg-[var(--a-input)] px-2.5 py-1.5 text-xs"
                  placeholder="Имя ключа"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    setSecretOnce(null);
                    void adminApiCreateKey(uid, keyName || 'Admin')
                      .then((r) => {
                        setSecretOnce(r.secret);
                        return refreshBundle();
                      })
                      .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка'))
                      .finally(() => setBusy(false));
                  }}
                  className="inline-flex items-center gap-1 rounded-lg bg-[var(--admin-accent)] px-3 py-1.5 text-xs font-semibold text-white"
                >
                  <IconPlus className="h-3.5 w-3.5" />
                  Ключ
                </button>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (!confirm('Отозвать все активные ключи клиента?')) return;
                  setBusy(true);
                  void adminApiRevokeAllKeys(uid)
                    .then(refreshBundle)
                    .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка'))
                    .finally(() => setBusy(false));
                }}
                className="w-full rounded-lg border border-[var(--a-border)] px-3 py-1.5 text-[11px] text-[var(--a-muted)] hover:bg-[var(--a-hover)]"
              >
                Отозвать все ключи
              </button>
            </div>
          </div>

          {secretOnce && (
            <div className="rounded-lg border border-[var(--a-ok-border)] bg-[var(--a-ok-soft)] px-3 py-2">
              <p className="text-[11px] text-[var(--a-ok)]">Секрет ключа (один раз)</p>
              <div className="mt-1 flex items-center gap-2">
                <code className="min-w-0 flex-1 break-all font-mono text-[12px]">{secretOnce}</code>
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[var(--a-border)]"
                  onClick={() => void navigator.clipboard.writeText(secretOnce)}
                  aria-label="Копировать"
                >
                  <IconCopy className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase text-[var(--a-faint)]">Ключи</p>
            <ul className="space-y-1.5">
              {bundle.keys.map((k) => (
                <li
                  key={k.id}
                  className="flex items-center gap-2 rounded-lg border border-[var(--a-border)] px-3 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold">
                      {k.name}{' '}
                      {k.revokedAt ? (
                        <span className="text-[var(--a-danger)]">отозван</span>
                      ) : (
                        <span className="text-[var(--a-ok)]">active</span>
                      )}
                    </p>
                    <p className="font-mono text-[10px] text-[var(--a-faint)]">
                      {k.prefix}… · {new Date(k.createdAt).toLocaleString('ru-RU')}
                      {k.lastUsedAt
                        ? ` · last ${new Date(k.lastUsedAt).toLocaleString('ru-RU')}`
                        : ''}
                    </p>
                  </div>
                  {!k.revokedAt && (
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--a-danger)] hover:bg-[var(--a-danger-soft)]"
                      aria-label="Отозвать"
                      onClick={() => {
                        if (!confirm('Отозвать ключ?')) return;
                        setBusy(true);
                        void adminApiRevokeKey(uid, k.id)
                          .then(refreshBundle)
                          .catch((e) => setError(e instanceof Error ? e.message : 'Ошибка'))
                          .finally(() => setBusy(false));
                      }}
                    >
                      <IconTrash className="h-3.5 w-3.5" />
                    </button>
                  )}
                </li>
              ))}
              {!bundle.keys.length && (
                <p className="text-xs text-[var(--a-faint)]">Ключей нет</p>
              )}
            </ul>
          </div>

          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase text-[var(--a-faint)]">
              Ledger (последние)
            </p>
            <div className="max-h-64 overflow-auto rounded-lg border border-[var(--a-border)]">
              <table className="w-full text-left text-[11px]">
                <thead className="sticky top-0 bg-[var(--a-elev)] text-[var(--a-faint)]">
                  <tr>
                    <th className="px-2 py-1.5 font-medium">Когда</th>
                    <th className="px-2 py-1.5 font-medium">Тип</th>
                    <th className="px-2 py-1.5 font-medium">Сумма</th>
                    <th className="px-2 py-1.5 font-medium">После</th>
                    <th className="px-2 py-1.5 font-medium">Детали</th>
                  </tr>
                </thead>
                <tbody>
                  {bundle.ledger.map((e) => (
                    <tr key={e.id} className="border-t border-[var(--a-border)]">
                      <td className="px-2 py-1.5 text-[var(--a-muted)] whitespace-nowrap">
                        {new Date(e.createdAt).toLocaleString('ru-RU')}
                      </td>
                      <td className="px-2 py-1.5">{e.type}</td>
                      <td className="px-2 py-1.5 tabular-nums">{formatUsd(e.amountUsd)}</td>
                      <td className="px-2 py-1.5 tabular-nums">{formatUsd(e.balanceAfter)}</td>
                      <td className="max-w-[200px] truncate px-2 py-1.5 text-[var(--a-muted)]" title={e.detail || ''}>
                        {[e.product, e.detail].filter(Boolean).join(' · ') || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!bundle.ledger.length && (
                <p className="px-3 py-4 text-xs text-[var(--a-faint)]">Пусто</p>
              )}
            </div>
          </div>
        </section>
      )}

      <section>
        <h3 className="mb-2 text-sm font-semibold">Клиенты с API</h3>
        <div className="overflow-x-auto rounded-xl border border-[var(--a-border)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--a-elev)] text-[11px] text-[var(--a-faint)]">
              <tr>
                <th className="px-3 py-2 font-medium">Клиент</th>
                <th className="px-3 py-2 font-medium">Баланс</th>
                <th className="px-3 py-2 font-medium">Ключи</th>
                <th className="px-3 py-2 font-medium">Статус</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.uid} className="border-t border-[var(--a-border)]">
                  <td className="px-3 py-2">
                    <p className="font-medium">{c.name || '—'}</p>
                    <p className="text-[11px] text-[var(--a-muted)]">{c.email}</p>
                  </td>
                  <td className="px-3 py-2 tabular-nums text-[var(--a-accent-fg)]">
                    {c.formatted}
                  </td>
                  <td className="px-3 py-2 text-[var(--a-muted)]">
                    {c.activeKeys}/{c.totalKeys}
                  </td>
                  <td className="px-3 py-2 text-[11px]">
                    {c.apiFrozen ? (
                      <span className="text-[var(--a-danger)]">frozen</span>
                    ) : (
                      <span className="text-[var(--a-ok)]">ok</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void openUser(c.uid)}
                      className="rounded-md border border-[var(--admin-accent)]/40 bg-[var(--admin-accent-soft)] px-2 py-1 text-[11px] text-[var(--a-accent-fg)]"
                    >
                      Открыть
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!clients.length && !busy && (
            <p className="px-3 py-6 text-center text-xs text-[var(--a-faint)]">
              Пока нет клиентов с ключами или балансом
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
