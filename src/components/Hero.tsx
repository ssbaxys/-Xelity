import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usePrefs } from '../context/PrefsContext';

function openAuth(mode: 'register' | 'login' = 'register') {
  window.dispatchEvent(new CustomEvent('xelity:open-auth', { detail: { mode } }));
}

export default function Hero() {
  const { user } = useAuth();
  const { theme } = usePrefs();
  const isLight = theme === 'light';

  return (
    <section className="relative overflow-hidden bg-paper text-ink sm:min-h-[100svh]">
      <div className="absolute inset-0">
        <img
          src="https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?auto=format&fit=crop&w=2400&q=80"
          alt=""
          className="animate-drift h-full w-full object-cover object-[center_30%] sm:object-center"
        />
        <div className="hero-veil absolute inset-0" />
        <div className="noise pointer-events-none absolute inset-0" />
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-paper to-transparent sm:h-36" />
      </div>

      <div className="relative mx-auto flex max-w-6xl flex-col justify-start px-4 pb-10 pt-[calc(4.75rem+env(safe-area-inset-top,0px))] sm:min-h-[100svh] sm:justify-end sm:px-6 sm:pb-20 sm:pt-28 lg:justify-center lg:pb-24 lg:pt-32">
        <div className="w-fit">
          <p
            className={`font-display animate-rise text-[clamp(2.5rem,12vw,5.5rem)] font-extrabold leading-none tracking-tight sm:text-7xl lg:text-8xl ${
              isLight ? 'text-ink' : 'text-white'
            }`}
          >
            Xelity
          </p>
          <div className="animate-draw mt-3 h-1 w-[calc(100%+0.85rem)] bg-signal sm:mt-4 sm:w-[calc(100%+1.25rem)]" />
        </div>

        <h1
          className={`font-display animate-rise delay-1 mt-5 max-w-[18ch] text-[clamp(1.35rem,5.5vw,2.75rem)] font-bold leading-[1.15] tracking-tight sm:mt-8 sm:max-w-xl ${
            isLight ? 'text-ink' : 'text-white'
          }`}
        >
          Меньше театра. Больше ответа.
        </h1>

        <p
          className={`animate-rise delay-2 mt-3 max-w-[34ch] text-[14px] leading-relaxed sm:mt-5 sm:max-w-md sm:text-base lg:text-lg ${
            isLight ? 'text-slate' : 'text-white/70'
          }`}
        >
          Xlaude Mini и Pro в поколениях K1 и K2 — для задач, где нужен результат, а не представление.
        </p>

        <div className="animate-rise delay-3 mt-7 flex w-full flex-col gap-2.5 sm:mt-10 sm:w-auto sm:flex-row sm:gap-3">
          {user ? (
            <Link to="/chat" className="btn-primary w-full justify-center sm:w-auto">
              Открыть чат
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => openAuth('register')}
              className="btn-primary w-full justify-center sm:w-auto"
            >
              Создать аккаунт
            </button>
          )}
          <Link
            to="/chat"
            className={`btn-ghost w-full justify-center sm:w-auto ${isLight ? '' : 'btn-ghost-on-dark'}`}
          >
            Попробовать Xlaude
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
