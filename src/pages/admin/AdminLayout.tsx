import { useEffect } from 'react';
import { NavLink, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { setPageMeta } from '../../lib/seo';

const links = [
  { to: '/admin', end: true, label: 'Обзор' },
  { to: '/admin/users', label: 'Пользователи' },
  { to: '/admin/payments', label: 'Платежи' },
  { to: '/admin/chats', label: 'Чаты' },
  { to: '/admin/broadcasts', label: 'Broadcasts' },
  { to: '/admin/tickets', label: 'Тикеты' },
];

export default function AdminLayout() {
  const { user, isAdmin, loading } = useAuth();
  const location = useLocation();

  useEffect(() => {
    setPageMeta({
      title: 'Админка',
      path: location.pathname,
      noindex: true,
    });
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="admin-shell flex min-h-screen items-center justify-center">
        <div className="admin-loading h-10 w-40" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="admin-shell admin-scroll min-h-screen">
      <header className="admin-header sticky top-0 z-40">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 xl:max-w-7xl">
          <div className="flex items-center gap-3">
            <NavLink
              to="/"
              className="text-sm text-[#9a8585] transition hover:text-white hover:-translate-x-0.5"
            >
              ← Сайт
            </NavLink>
            <div className="h-4 w-px bg-[#2a1c1c]" />
            <h1 className="text-sm font-semibold tracking-[0.08em] text-[#f3ecec]">
              XELITY <span className="text-[#c62828]">ADMIN</span>
            </h1>
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
