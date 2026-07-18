import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePrefs } from '../context/PrefsContext';
import AuthModal, { type AuthMode } from './AuthModal';

const linkDefs = [
  { key: 'nav.chat', to: '/chat', hint: 'Диалоги с Xlaude' },
  { key: 'nav.pricing', to: '/pricing', hint: 'Free · Pro · Max' },
  { key: 'nav.product', to: '/#product', hint: 'Возможности' },
  { key: 'nav.model', to: '/#models', hint: 'Mini K1 · Pro · K2' },
  { key: 'nav.company', to: '/#company', hint: 'О Xelity' },
  { key: 'nav.safety', to: '/#safety', hint: 'Принципы' },
];

export default function Navbar() {
  const { user, loading, logout } = useAuth();
  const { t } = usePrefs();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('register');
  const onHome = location.pathname === '/';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [location.pathname]);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname, location.hash]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    const openAuth = (e: Event) => {
      const detail = (e as CustomEvent<{ mode?: AuthMode }>).detail;
      setAuthMode(detail?.mode === 'login' ? 'login' : 'register');
      setAuthOpen(true);
    };
    window.addEventListener('xelity:open-auth', openAuth);
    return () => window.removeEventListener('xelity:open-auth', openAuth);
  }, []);

  const openAuth = (mode: AuthMode) => {
    setAuthMode(mode);
    setAuthOpen(true);
    setOpen(false);
  };

  const solid = scrolled || !onHome || open;

  return (
    <>
      <header
        className={`fixed inset-x-0 top-0 transition-all duration-300 ${
          open ? 'z-[60]' : 'z-50'
        } ${
          solid
            ? 'border-b border-line bg-paper/90 shadow-[0_8px_30px_rgba(0,0,0,0.25)] backdrop-blur-xl'
            : 'bg-transparent'
        }`}
      >
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:h-20">
          <Link to="/" className="group flex items-center gap-2.5" onClick={() => setOpen(false)}>
            <div className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-md bg-signal transition group-hover:scale-105">
              <svg
                viewBox="0 0 24 24"
                className="relative h-4 w-4 text-white"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
                <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
              </svg>
            </div>
            <span
              className={`font-display text-[15px] font-bold tracking-tight ${
                solid ? 'text-ink' : 'text-white'
              }`}
            >
              Xelity
            </span>
          </Link>

          <div className="hidden items-center gap-1 md:flex">
            {linkDefs.map((link) => (
              <Link
                key={link.key}
                to={link.to}
                className={`rounded-md px-3.5 py-2 text-sm transition hover:-translate-y-0.5 ${
                  solid
                    ? 'text-ink/65 hover:bg-ink/5 hover:text-ink'
                    : 'text-white/65 hover:bg-white/5 hover:text-white'
                }`}
              >
                {t(link.key)}
              </Link>
            ))}
          </div>

          <div className="hidden items-center gap-3 md:flex">
            {loading ? (
              <div className="h-9 w-28 animate-pulse rounded-md bg-white/10" />
            ) : user ? (
              <>
                <div
                  className={`flex items-center gap-2 rounded-md border px-3 py-1.5 ${
                    solid ? 'border-line bg-mist' : 'border-white/15 bg-white/5'
                  }`}
                >
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt=""
                      className="h-6 w-6 rounded-md object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-signal text-[10px] font-bold text-white">
                      {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span className={`max-w-[140px] truncate text-sm ${solid ? 'text-ink' : 'text-white'}`}>
                    {user.displayName || user.email}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => logout()}
                  className={`rounded-md px-3.5 py-2 text-sm transition ${
                    solid ? 'text-slate hover:text-ink' : 'text-white/65 hover:text-white'
                  }`}
                >
                  {t('nav.logout')}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => openAuth('login')}
                  className={`rounded-md px-3.5 py-2 text-sm transition ${
                    solid ? 'text-slate hover:text-ink' : 'text-white/65 hover:text-white'
                  }`}
                >
                  {t('nav.login')}
                </button>
                <button
                  type="button"
                  onClick={() => openAuth('register')}
                  className="rounded-md bg-signal px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#e53935]"
                >
                  {t('nav.register')}
                </button>
              </>
            )}
          </div>

          <button
            type="button"
            className={`relative z-[56] flex h-11 w-11 items-center justify-center rounded-xl transition md:hidden ${
              solid || open ? 'bg-mist text-ink' : 'bg-white/10 text-white'
            }`}
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Закрыть меню' : 'Открыть меню'}
            aria-expanded={open}
          >
            <span className="nav-burger" data-open={open ? '1' : '0'}>
              <span />
              <span />
              <span />
            </span>
          </button>
        </nav>
      </header>

      {/* Mobile full-screen menu */}
      <div
        className={`fixed inset-0 z-[55] md:hidden ${open ? 'pointer-events-auto' : 'pointer-events-none'}`}
        aria-hidden={!open}
      >
        <button
          type="button"
          className={`nav-mobile-backdrop absolute inset-0 bg-black/55 backdrop-blur-[2px] transition-opacity duration-300 ${
            open ? 'opacity-100' : 'opacity-0'
          }`}
          aria-label="Закрыть"
          onClick={() => setOpen(false)}
        />

        <div
          className={`nav-mobile-sheet absolute inset-x-0 top-0 flex max-h-[100dvh] flex-col bg-paper pt-16 shadow-2xl transition-transform duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            open ? 'translate-y-0' : '-translate-y-[108%]'
          }`}
          style={{ paddingTop: 'calc(4rem + env(safe-area-inset-top, 0px))' }}
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-2">
            <p className="mb-3 px-1 text-[11px] font-medium uppercase tracking-[0.14em] text-slate">
              Навигация
            </p>
            <nav className="flex flex-col gap-1.5">
              {linkDefs.map((link, i) => (
                <Link
                  key={link.key}
                  to={link.to}
                  onClick={() => setOpen(false)}
                  className={`nav-mobile-item group flex items-center justify-between rounded-2xl border border-line/80 bg-elevated px-4 py-3.5 transition active:scale-[0.98] ${
                    open ? 'nav-mobile-item-in' : ''
                  }`}
                  style={{ animationDelay: open ? `${80 + i * 45}ms` : '0ms' }}
                >
                  <span>
                    <span className="block font-display text-[17px] font-semibold tracking-tight text-ink">
                      {t(link.key)}
                    </span>
                    <span className="mt-0.5 block text-[12px] text-slate">{link.hint}</span>
                  </span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-mist text-slate transition group-hover:bg-signal/15 group-hover:text-signal">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </Link>
              ))}
            </nav>

            <div
              className={`mt-5 rounded-2xl border border-line bg-elevated p-4 ${
                open ? 'nav-mobile-item-in' : ''
              }`}
              style={{ animationDelay: open ? `${80 + linkDefs.length * 45}ms` : '0ms' }}
            >
              {loading ? (
                <div className="h-11 animate-pulse rounded-xl bg-mist" />
              ) : user ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt=""
                        className="h-11 w-11 rounded-xl object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-signal text-sm font-bold text-white">
                        {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink">
                        {user.displayName || 'Аккаунт'}
                      </p>
                      <p className="truncate text-[12px] text-slate">{user.email}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Link
                      to="/support"
                      onClick={() => setOpen(false)}
                      className="rounded-xl border border-line bg-mist px-3 py-3 text-center text-[13px] font-medium text-ink"
                    >
                      Поддержка
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        logout();
                        setOpen(false);
                      }}
                      className="rounded-xl border border-line bg-mist px-3 py-3 text-[13px] font-medium text-slate"
                    >
                      {t('nav.logout')}
                    </button>
                  </div>
                  <Link
                    to="/chat"
                    onClick={() => setOpen(false)}
                    className="flex w-full items-center justify-center rounded-xl bg-signal px-4 py-3.5 text-[14px] font-semibold text-white"
                  >
                    Открыть чат
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => openAuth('register')}
                    className="flex w-full items-center justify-center rounded-xl bg-signal px-4 py-3.5 text-[14px] font-semibold text-white"
                  >
                    {t('nav.register')}
                  </button>
                  <button
                    type="button"
                    onClick={() => openAuth('login')}
                    className="flex w-full items-center justify-center rounded-xl border border-line bg-mist px-4 py-3.5 text-[14px] font-medium text-ink"
                  >
                    {t('nav.login')}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div
            className="shrink-0 border-t border-line px-4 py-3 text-center text-[11px] text-slate"
            style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
          >
            Меньше театра. Больше ответа.
          </div>
        </div>
      </div>

      <AuthModal
        open={authOpen}
        mode={authMode}
        onClose={() => setAuthOpen(false)}
        onModeChange={setAuthMode}
      />
    </>
  );
}
