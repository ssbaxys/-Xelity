import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  isMaintenanceActive,
  watchMaintenance,
  type MaintenanceState,
} from '../lib/rtdb';

function formatUntil(until: number | null, permanent: boolean): string {
  if (permanent || until == null) return 'до снятия администратором';
  try {
    return `до ${new Date(until).toLocaleString()}`;
  } catch {
    return 'временно';
  }
}

export default function MaintenanceGuard({ children }: { children: React.ReactNode }) {
  const { isStaff, loading } = useAuth();
  const location = useLocation();
  const [state, setState] = useState<MaintenanceState | null>(null);

  useEffect(() => watchMaintenance(setState), []);

  const active = isMaintenanceActive(state);
  const adminPath =
    location.pathname === '/admin' || location.pathname.startsWith('/admin/');

  // Staff всегда проходит; админку тоже не блокируем
  if (loading || !active || isStaff || adminPath) {
    return <>{children}</>;
  }

  return (
    <div className="xelity-maintenance">
      <div className="xelity-maintenance-card">
        <p className="xelity-maintenance-kicker">Xelity</p>
        <h1 className="xelity-maintenance-title">Технические работы</h1>
        <p className="xelity-maintenance-reason">
          {state?.reason?.trim() || 'Сервис временно недоступен. Скоро вернёмся.'}
        </p>
        <p className="xelity-maintenance-until">
          {formatUntil(state?.until ?? null, Boolean(state?.permanent))}
        </p>
      </div>
    </div>
  );
}
