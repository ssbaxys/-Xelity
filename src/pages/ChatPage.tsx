import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { usePrefs } from '../context/PrefsContext';
import ChatWorkspace from '../components/ChatWorkspace';
import { setPageMeta } from '../lib/seo';

export default function ChatPage() {
  const { t } = usePrefs();

  useEffect(() => {
    setPageMeta({
      title: 'Чат',
      description: 'Рабочее пространство Xelity для диалогов на Xlaude.',
      path: '/chat',
      noindex: true,
    });
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, []);

  return (
    <div className="chat-app fixed inset-0 h-dvh max-h-dvh overflow-hidden bg-[var(--c-bg)] text-[var(--c-text)] antialiased">
      <ChatWorkspace
        homeSlot={
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] text-[var(--c-muted)] transition hover:bg-[var(--c-hover)] hover:text-[var(--c-text)] hover:-translate-x-0.5"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            {t('chat.home')}
          </Link>
        }
      />
    </div>
  );
}
