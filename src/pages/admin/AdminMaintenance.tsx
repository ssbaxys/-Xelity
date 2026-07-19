import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  isMaintenanceActive,
  saveMaintenance,
  watchMaintenance,
  type MaintenanceState,
} from '../../lib/rtdb';
import AdminSelect from './AdminSelect';

const PRESETS: { id: string; label: string; ms: number | null }[] = [
  { id: '1h', label: '1 час', ms: 60 * 60 * 1000 },
  { id: '3h', label: '3 часа', ms: 3 * 60 * 60 * 1000 },
  { id: '6h', label: '6 часов', ms: 6 * 60 * 60 * 1000 },
  { id: '12h', label: '12 часов', ms: 12 * 60 * 60 * 1000 },
  { id: '24h', label: '24 часа', ms: 24 * 60 * 60 * 1000 },
  { id: '3d', label: '3 дня', ms: 3 * 24 * 60 * 60 * 1000 },
  { id: 'forever', label: 'Пока не сниму', ms: null },
  { id: 'custom', label: 'Своя дата/время', ms: -1 },
];

export default function AdminMaintenance() {
  const { user } = useAuth();
  const [current, setCurrent] = useState<MaintenanceState | null>(null);
  const [reason, setReason] = useState('');
  const [preset, setPreset] = useState('1h');
  const [customLocal, setCustomLocal] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => watchMaintenance(setCurrent), []);

  useEffect(() => {
    if (current?.reason) setReason(current.reason);
  }, [current?.reason]);

  const active = isMaintenanceActive(current);

  const resolveUntil = (): { until: number | null; permanent: boolean } => {
    const p = PRESETS.find((x) => x.id === preset) || PRESETS[0];
    if (p.id === 'forever' || p.ms === null) {
      return { until: null, permanent: true };
    }
    if (p.id === 'custom') {
      if (!customLocal) throw new Error('Укажите дату и время окончания');
      const ts = new Date(customLocal).getTime();
      if (!Number.isFinite(ts) || ts <= Date.now()) {
        throw new Error('Дата должна быть в будущем');
      }
      return { until: ts, permanent: false };
    }
    return { until: Date.now() + (p.ms || 0), permanent: false };
  };

  const enable = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      const { until, permanent } = resolveUntil();
      await saveMaintenance({
        enabled: true,
        reason: reason.trim() || 'Технические работы. Скоро вернёмся.',
        until,
        permanent,
        updatedBy: user.uid,
        updatedByEmail: user.email || undefined,
      });
      setOk('Техработы включены');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    if (!user) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await saveMaintenance({
        enabled: false,
        reason: reason.trim(),
        until: null,
        permanent: false,
        updatedBy: user.uid,
        updatedByEmail: user.email || undefined,
      });
      setOk('Техработы сняты');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Техработы</h2>
        <p className="text-sm text-[var(--a-muted)]">
          Закрывает сайт для обычных пользователей. Staff и админ-панель остаются доступны.
        </p>
      </div>

      <div
        className={`admin-panel p-4 ${
          active ? 'border-[rgba(198,40,40,0.45)]' : ''
        }`}
      >
        <p className="text-sm font-medium">
          Статус:{' '}
          <span className={active ? 'text-[#e57373]' : 'text-[#81c784]'}>
            {active ? 'Включены' : 'Выключены'}
          </span>
        </p>
        {current?.enabled && (
          <p className="mt-2 text-sm text-[var(--a-muted)] whitespace-pre-wrap">
            {current.reason || '—'}
          </p>
        )}
        {active && (
          <p className="mt-1 text-[11px] text-[var(--a-faint)]">
            {current?.permanent || current?.until == null
              ? 'До ручного снятия'
              : `До ${new Date(current.until!).toLocaleString()}`}
            {current?.updatedByEmail ? ` · ${current.updatedByEmail}` : ''}
          </p>
        )}
      </div>

      <form onSubmit={enable} className="admin-panel space-y-3 p-4">
        <label className="block text-xs text-[var(--a-muted)]">
          Причина (видят пользователи)
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Обновляем API и SearXNG…"
            className="mt-1 w-full resize-y rounded-lg border border-[var(--a-border)] bg-[var(--a-input)] px-3 py-2 text-sm outline-none focus:border-[var(--admin-accent)]/50"
          />
        </label>

        <label className="block text-xs text-[var(--a-muted)]">
          Длительность
          <div className="mt-1">
            <AdminSelect
              value={preset}
              onChange={setPreset}
              options={PRESETS.map((p) => ({ value: p.id, label: p.label }))}
            />
          </div>
        </label>

        {preset === 'custom' && (
          <label className="block text-xs text-[var(--a-muted)]">
            Окончание
            <input
              type="datetime-local"
              value={customLocal}
              onChange={(e) => setCustomLocal(e.target.value)}
              className="mt-1 w-full rounded-lg border border-[var(--a-border)] bg-[var(--a-input)] px-3 py-2 text-sm outline-none focus:border-[var(--admin-accent)]/50"
            />
          </label>
        )}

        {error && <p className="admin-error-inline">{error}</p>}
        {ok && <p className="text-sm text-[#81c784]">{ok}</p>}

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-[var(--admin-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            Включить техработы
          </button>
          <button
            type="button"
            disabled={busy || !current?.enabled}
            onClick={() => void disable()}
            className="rounded-lg border border-[var(--a-border)] px-4 py-2 text-sm font-medium text-[var(--a-text)] disabled:opacity-40"
          >
            Снять
          </button>
        </div>
      </form>
    </div>
  );
}
