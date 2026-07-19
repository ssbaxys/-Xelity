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

const DESKTOP_MQ = '(min-width: 768px)';

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

  // На ПК гамбургер не нужен — закрываем drawer при расширении окна
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_MQ);
    const onChange = () => {
      if (mq.matches) setNavOpen(false);
    };
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

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
    '--admin-accent-soft': brand.accentSoft,
  } as CSSProperties;

  if (loading) {
    return (
      <div className={`${shellClass} flex min-h-screen items-center justify-center`} style={shellStyle}>
        <div className="admin-loading h-10 w-40" />
      </div>
    );
  }

  if (!user || !isStaff) {
    return <Navigate to="/chat" replace />;
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
        <div className="admin-header-inner">
          <div className="admin-header-brand">
            <NavLink to="/chat" className="admin-back-chat">
              ← Чат
            </NavLink>
            <div className="admin-header-divider" aria-hidden />
            <div className="min-w-0">
              <h1 className="admin-header-title">
                XELITY <span className="admin-brand-code">{brand.code}</span>
              </h1>
              <p className="admin-brand-hint truncate">{brand.hint}</p>
            </div>
          </div>

          <div className="admin-header-actions">
            <button
              type="button"
              className="admin-theme-toggle"
              aria-label={isLight ? 'Тёмная тема' : 'Светлая тема'}
              title={isLight ? 'Тёмная тема' : 'Светлая тема'}
              onClick={() => setTheme(isLight ? 'dark' : 'light')}
            >
              {isLight ? <IconMoon className="h-4 w-4" /> : <IconSun className="h-4 w-4" />}
            </button>

            <nav className="admin-nav-desktop" aria-label="Админ">
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
              className="admin-nav-burger"
              aria-label={navOpen ? 'Закрыть меню' : 'Открыть меню'}
              aria-expanded={navOpen}
              onClick={() => setNavOpen((v) => !v)}
            >
              {navOpen ? <IconClose className="h-4 w-4" /> : <IconMenu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {navOpen && (
          <div className="admin-nav-mobile">
            <NavLink to="/chat" className="admin-nav-mobile-chat">
              ← В чат
            </NavLink>
            <nav className="admin-nav-drawer" aria-label="Админ меню">
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

      <main className="admin-main">
        <div key={location.pathname} className="admin-page min-w-0">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
