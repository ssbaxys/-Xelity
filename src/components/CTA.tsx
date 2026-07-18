import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Reveal from './Reveal';

function openAuth(mode: 'register' | 'login' = 'register') {
  window.dispatchEvent(new CustomEvent('xelity:open-auth', { detail: { mode } }));
}

export default function CTA() {
  const { user } = useAuth();

  return (
    <section id="contact" className="relative bg-mist py-24 lg:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-elevated px-8 py-14 sm:px-12 lg:px-16 lg:py-20">
            <div className="pointer-events-none absolute -right-16 top-0 h-64 w-64 animate-pulse rounded-full bg-signal/15 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 anim-float rounded-full bg-azure/15 blur-3xl" />
            <div className="noise pointer-events-none absolute inset-0 opacity-[0.08]" />

            <div className="relative text-center">
              {user ? (
                <>
                  <h2 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-5xl">
                    Вы уже в Xelity
                  </h2>
                  <p className="mx-auto mt-4 max-w-lg text-base text-slate">
                    Аккаунт <span className="text-ink">{user.email}</span> активен. Профиль сохранён в
                    Firebase Realtime Database.
                  </p>
                  <div className="mt-10 inline-flex items-center gap-2 rounded-md border border-signal/30 bg-signal/10 px-5 py-2.5 text-sm font-medium text-signal">
                    <span className="h-2 w-2 animate-pulse rounded-sm bg-signal" />
                    {user.displayName || 'Пользователь'} · подключено
                  </div>
                  <div className="mt-6">
                    <Link to="/chat" className="btn-primary">
                      Перейти в чат
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <h2 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-5xl">
                    Начните с Xlaude
                  </h2>
                  <p className="mx-auto mt-4 max-w-lg text-base text-slate">
                    Регистрация по email/паролю или через Google. Затем откройте чат и создайте свои
                    панели.
                  </p>

                  <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
                    <button type="button" onClick={() => openAuth('register')} className="btn-primary">
                      Зарегистрироваться
                    </button>
                    <Link to="/chat" className="btn-ghost">
                      Открыть чат
                    </Link>
                  </div>

                  <p className="mt-5 text-xs text-slate/70">
                    Продолжая, вы соглашаетесь с{' '}
                    <Link to="/terms" className="text-ink underline-offset-2 hover:underline">
                      Условиями
                    </Link>{' '}
                    и{' '}
                    <Link to="/privacy" className="text-ink underline-offset-2 hover:underline">
                      Политикой конфиденциальности
                    </Link>
                    .
                  </p>
                </>
              )}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
