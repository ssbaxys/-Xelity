import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { IconClose, IconMenu, IconMoon, IconSun } from '../../components/icons';
import { useAuth } from '../../context/AuthContext';
import { usePrefs } from '../../context/PrefsContext';
import { setPageMeta } from '../../lib/seo';
import {
  defaultAdminPath,
  navForRole,
  pathAllowed,
  staffBrand,
} from '../../lib/staff';

export default function AdminLayout() {
  const { user, isStaff, staffRole, loading } = useAuth();
  const { theme, setTheme } = usePrefs();
  const location = useLocation();
  const brand = staffBrand(staffRole);
  const links = useMemo(() => navForRole(staffRole), [staffRole]);
  const isLight = theme === 'light';
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    setPageMeta({
      title: brand.code,
      path: location.pathname,
      noindex: true,
    });
  }, [location.pathname, brand.code]);

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!navOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [navOpen]);

  const shellClass = `admin-shell admin-theme-${brand.theme} admin-scroll ${
    isLight ? 'is-light' : ''
  }`;

  const shellStyle = {
    '--admin-accent': brand.accent,
  } as CSSProperties;

  if (loading) {
    return (
      <div className={`${shellClass} flex min-h-screen items-center justify-center`} style={shellStyle}>
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

  if (
    (location.pathname === '/admin' || location.pathname === '/admin/') &&
    !links.some((l) => l.to === '/admin' && l.end)
  ) {
    return <Navigate to={defaultAdminPath(staffRole)} replace />;
  }

  return (
    <div className={`${shellClass} min-h-dvh`} style={shellStyle}>
      <header className="admin-header sticky top-0 z-40">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-2.5 sm:px-4 sm:py-3 xl:max-w-7xl">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <NavLink
              to="/"
              className="hidden shrink-0 text-sm text-[var(--a-muted)] transition hover:text-[var(--a-text)] sm:inline"
            >
              ← Сайт
            </NavLink>
            <div className="hidden h-4 w-px bg-[var(--a-border)] sm:block" />
            <div className="min-w-0">
              <h1 className="truncate text-[13px] font-semibold tracking-[0.06em] text-[var(--a-text)] sm:text-sm sm:tracking-[0.08em]">
                XELITY <span className="admin-brand-code">{brand.code}</span>
              </h1>
              <p className="admin-brand-hint truncate text-[10px] text-[var(--a-faint)]">{brand.hint}</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <button
              type="button"
              className="admin-theme-toggle"
              aria-label={isLight ? 'Тёмная тема' : 'Светлая тема'}
              title={isLight ? 'Тёмная тема' : 'Светлая тема'}
              onClick={() => setTheme(isLight ? 'dark' : 'light')}
            >
              {isLight ? <IconMoon className="h-4 w-4" /> : <IconSun className="h-4 w-4" />}
            </button>

            <nav className="hidden flex-wrap justify-end gap-1 md:flex">
              {links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.end}
                  className={({ isActive }) => `admin-nav-link ${isActive ? 'is-active' : ''}`}
                >
                  {l.label}
                </NavLink>
              ))}
            </nav>

            <button
              type="button"
              className="admin-theme-toggle md:hidden"
              aria-label={navOpen ? 'Закрыть меню' : 'Открыть меню'}
              aria-expanded={navOpen}
              onClick={() => setNavOpen((v) => !v)}
            >
              {navOpen ? <IconClose className="h-4 w-4" /> : <IconMenu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {navOpen && (
          <div className="border-t border-[var(--a-border)] px-3 pb-3 pt-2 md:hidden">
            <NavLink
              to="/"
              className="mb-2 block rounded-lg px-2.5 py-2 text-sm text-[var(--a-muted)] hover:bg-[var(--a-hover)] hover:text-[var(--a-text)]"
            >
              ← На сайт
            </NavLink>
            <nav className="admin-nav-drawer flex flex-col gap-0.5">
              {links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.end}
                  className={({ isActive }) =>
                    `admin-nav-link w-full text-left ${isActive ? 'is-active' : ''}`
                  }
                >
                  {l.label}
                </NavLink>
              ))}
            </nav>
          </div>
        )}
      </header>

      <main className="admin-main mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6 xl:max-w-7xl">
        <div key={location.pathname} className="admin-page min-w-0">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
