import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { usePrefs } from '../context/PrefsContext';
import { setPageMeta } from '../lib/seo';

export default function NotFoundPage() {
  const { t } = usePrefs();

  useEffect(() => {
    setPageMeta({
      title: 'Страница не найдена',
      description: 'Запрошенная страница не найдена на Xelity.',
      path: '/404',
      noindex: true,
    });
  }, []);

  return (
    <div className="chat-app fixed inset-0 overflow-y-auto bg-[var(--c-bg)] text-[var(--c-text)] antialiased">
      <div className="pointer-events-none fixed inset-0 section-grid opacity-30" />
      <div className="relative mx-auto flex min-h-full max-w-lg flex-col items-center justify-center px-6 py-16 text-center">
        <Link
          to="/"
          className="absolute left-5 top-5 inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] text-[var(--c-muted)] transition hover:bg-[var(--c-hover)] hover:text-[var(--c-text)]"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          {t('chat.home')}
        </Link>

        <p className="font-display text-6xl font-extrabold text-signal">404</p>
        <h1 className="font-display mt-4 text-3xl font-bold text-[var(--c-text)]">Страница не найдена</h1>
        <p className="mt-3 text-[var(--c-muted)]">Такой страницы нет. Вернитесь на главную или откройте чат.</p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link to="/" className="btn-primary">
            {t('chat.home')}
          </Link>
          <Link
            to="/chat"
            className="inline-flex h-11 items-center justify-center rounded-lg border border-[var(--c-border-strong)] px-5 text-sm font-medium text-[var(--c-text)] transition hover:bg-[var(--c-hover)]"
          >
            {t('nav.chat')}
          </Link>
        </div>
      </div>
    </div>
  );
}
