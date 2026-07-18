import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/** Маршруты, доступные при бане (обычным пользователям) */
const ALLOWED = new Set(['/', '/banned', '/404']);

export default function BanGuard({ children }: { children: React.ReactNode }) {
  const { isBanned, isStaff, loading } = useAuth();
  const location = useLocation();

  if (loading) return <>{children}</>;

  const path = location.pathname;
  /** Staff может работать в панели даже если аккаунт забанен */
  const adminPanel = isStaff && (path === '/admin' || path.startsWith('/admin/'));
  const allowed = ALLOWED.has(path) || path.startsWith('/404') || adminPanel;

  if (isBanned && !allowed) {
    return <Navigate to="/banned" replace state={{ from: path }} />;
  }

  if (!isBanned && path === '/banned') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
