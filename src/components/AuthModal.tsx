import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';

export type AuthMode = 'register' | 'login';

interface AuthModalProps {
  open: boolean;
  mode: AuthMode;
  onClose: () => void;
  onModeChange: (mode: AuthMode) => void;
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.8-5.5 3.8-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.3 12 2.3 6.9 2.3 2.8 6.4 2.8 11.5S6.9 20.7 12 20.7c6.9 0 9.1-4.8 9.1-7.3 0-.5 0-.9-.1-1.2H12z"
      />
      <path
        fill="#34A853"
        d="M3.9 7.4l3.2 2.3C8 7.4 9.8 6.2 12 6.2c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.3 12 2.3 8.4 2.3 5.3 4.4 3.9 7.4z"
      />
      <path
        fill="#4A90E2"
        d="M12 20.7c2.5 0 4.6-.8 6.1-2.2l-3-2.4c-.8.6-1.9 1-3.1 1-2.4 0-4.4-1.6-5.1-3.8l-3.2 2.5c1.4 2.9 4.5 4.9 8.3 4.9z"
      />
      <path
        fill="#FBBC05"
        d="M6.9 13.3c-.2-.6-.3-1.2-.3-1.8s.1-1.2.3-1.8L3.7 7.2C3.1 8.5 2.8 10 2.8 11.5s.3 3 1.1 4.3l3-2.5z"
      />
    </svg>
  );
}

export default function AuthModal({ open, mode, onClose, onModeChange }: AuthModalProps) {
  const { register, login, loginWithGoogle } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [company, setCompany] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setSuccess('');
    setSubmitting(false);
    setGoogleLoading(false);
  }, [open, mode]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const isRegister = mode === 'register';
  const busy = submitting || googleLoading;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSubmitting(true);

    try {
      if (isRegister) {
        if (name.trim().length < 2) {
          throw new Error('Укажите имя (минимум 2 символа).');
        }
        if (password.length < 6) {
          throw new Error('Пароль должен быть не короче 6 символов.');
        }
        await register({ name, email, password, company });
        setSuccess('Аккаунт создан. Добро пожаловать в Xelity!');
        setTimeout(onClose, 900);
      } else {
        await login(email, password);
        setSuccess('Вы вошли в аккаунт.');
        setTimeout(onClose, 700);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка. Попробуйте снова.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setSuccess('');
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
      setSuccess(isRegister ? 'Аккаунт Google подключён.' : 'Вы вошли через Google.');
      setTimeout(onClose, 700);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка входа через Google.');
    } finally {
      setGoogleLoading(false);
    }
  };

  const fieldClass =
    'h-11 w-full rounded-lg border border-line bg-mist px-4 text-sm text-ink outline-none placeholder:text-slate/50 focus:border-azure focus:ring-1 focus:ring-azure/30';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Закрыть"
        className="ui-backdrop absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="ui-sheet relative w-full max-w-md overflow-hidden rounded-2xl border border-line bg-elevated shadow-2xl shadow-black/50">
        <div className="relative p-6 sm:p-8">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow">Xelity</p>
              <h2 className="font-display mt-1 text-2xl font-bold tracking-tight text-ink">
                {isRegister ? 'Создать аккаунт' : 'Войти'}
              </h2>
              <p className="mt-2 text-sm text-slate">
                {isRegister
                  ? 'Email/пароль или Google. Профиль сохраняется в Realtime Database.'
                  : 'Войдите через email/пароль или Google.'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line text-slate transition hover:bg-mist hover:text-ink"
              aria-label="Закрыть"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                <path strokeLinecap="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg border border-line bg-mist p-1">
            <button
              type="button"
              onClick={() => onModeChange('register')}
              className={`rounded-md py-2 text-sm transition ${
                isRegister ? 'bg-signal font-semibold text-white' : 'text-slate hover:text-ink'
              }`}
            >
              Регистрация
            </button>
            <button
              type="button"
              onClick={() => onModeChange('login')}
              className={`rounded-md py-2 text-sm transition ${
                !isRegister ? 'bg-signal font-semibold text-white' : 'text-slate hover:text-ink'
              }`}
            >
              Вход
            </button>
          </div>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={busy}
            className="mb-4 flex h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-line bg-mist text-sm font-semibold text-ink transition hover:border-azure/40 hover:bg-elevated disabled:cursor-not-allowed disabled:opacity-60"
          >
            <GoogleIcon />
            {googleLoading
              ? 'Открываем Google…'
              : isRegister
                ? 'Продолжить с Google'
                : 'Войти через Google'}
          </button>

          <div className="mb-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-line" />
            <span className="text-[11px] uppercase tracking-wider text-slate/70">или email</span>
            <div className="h-px flex-1 bg-line" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {isRegister && (
              <>
                <label className="block">
                  <span className="mb-1.5 block text-xs text-slate">Имя</span>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Анна Иванова"
                    className={fieldClass}
                  />
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-xs text-slate">
                    Компания <span className="text-slate/50">(необязательно)</span>
                  </span>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Xelity Labs"
                    className={fieldClass}
                  />
                </label>
              </>
            )}

            <label className="block">
              <span className="mb-1.5 block text-xs text-slate">Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className={fieldClass}
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs text-slate">Пароль</span>
              <input
                type="password"
                required
                minLength={6}
                autoComplete={isRegister ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Минимум 6 символов"
                className={fieldClass}
              />
            </label>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                {error}
              </div>
            )}

            {success && (
              <div className="rounded-lg border border-signal/40 bg-signal/15 px-3.5 py-2.5 text-sm text-ink">
                {success}
              </div>
            )}

            <button type="submit" disabled={busy} className="btn-ink mt-1 w-full disabled:opacity-60">
              {submitting
                ? isRegister
                  ? 'Создаём…'
                  : 'Входим…'
                : isRegister
                  ? 'Зарегистрироваться'
                  : 'Войти'}
            </button>
          </form>

          <p className="mt-5 text-center text-xs leading-relaxed text-slate/70">
            Вход через Email/пароль и Google · данные в Firebase Realtime Database
          </p>
        </div>
      </div>
    </div>
  );
}
