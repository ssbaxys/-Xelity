import { useEffect, useMemo, type CSSProperties } from 'react';
import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { setPageMeta } from '../../lib/seo';
import {
  defaultAdminPath,
  navForRole,
  pathAllowed,
  staffBrand,
} from '../../lib/staff';

export default function AdminLayout() {
  const { user, isStaff, staffRole, loading } = useAuth();
  const location = useLocation();
  const brand = staffBrand(staffRole);
  const links = useMemo(() => navForRole(staffRole), [staffRole]);

  useEffect(() => {
    setPageMeta({
      title: brand.code,
      path: location.pathname,
      noindex: true,
    });
  }, [location.pathname, brand.code]);

  if (loading) {
    return (
      <div className={`admin-shell admin-theme-${brand.theme} flex min-h-screen items-center justify-center`}>
        <div className="admin-loading h-10 w-40" />
      </div>
    );
  }

  if (!user || !isStaff) {
    return <Navigate to="/" replace />;
  }

  if (!pathAllowed(location.pathname, staffRole)) {
    return <Navigate to={defaultAdminPath(staffRole)} replace />;
  }

  // Helper без dashboard: /admin → тикеты
  if (
    (location.pathname === '/admin' || location.pathname === '/admin/') &&
    !links.some((l) => l.to === '/admin' && l.end)
  ) {
    return <Navigate to={defaultAdminPath(staffRole)} replace />;
  }

  return (
    <div
      className={`admin-shell admin-theme-${brand.theme} admin-scroll min-h-screen`}
      style={
        {
          '--admin-accent': brand.accent,
          '--admin-accent-soft': brand.accentSoft,
        } as CSSProperties
      }
    >
      <header className="admin-header sticky top-0 z-40">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 xl:max-w-7xl">
          <div className="flex min-w-0 items-center gap-3">
            <NavLink
              to="/"
              className="text-sm text-[#9a8585] transition hover:text-white hover:-translate-x-0.5"
            >
              ← Сайт
            </NavLink>
            <div className="h-4 w-px bg-[#2a1c1c]" />
            <div className="min-w-0">
              <h1 className="text-sm font-semibold tracking-[0.08em] text-[#f3ecec]">
                XELITY{' '}
                <span className="admin-brand-code">{brand.code}</span>
              </h1>
              <p className="truncate text-[10px] text-[#6e5555]">{brand.hint}</p>
            </div>
          </div>
          <nav className="flex flex-wrap gap-1">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={({ isActive }) =>
                  `admin-nav-link ${isActive ? 'is-active' : ''}`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 xl:max-w-7xl">
        <div key={location.pathname} className="admin-page">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
