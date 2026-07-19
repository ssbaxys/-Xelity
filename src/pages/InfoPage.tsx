import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getPage } from '../data/pages';
import { usePrefs } from '../context/PrefsContext';
import { setPageMeta } from '../lib/seo';
import NotFoundPage from './NotFoundPage';

export default function InfoPage() {
  const { slug = '' } = useParams();
  const page = getPage(slug);
  const { t } = usePrefs();

  useEffect(() => {
    if (!page) return;
    setPageMeta({
      title: page.title,
      description: page.summary,
      path: `/${page.slug}`,
    });
  }, [page]);

  if (!page) {
    return <NotFoundPage />;
  }

  return (
    <div className="chat-app fixed inset-0 overflow-y-auto bg-[var(--c-bg)] text-[var(--c-text)] antialiased">
      <div className="pointer-events-none fixed inset-0 section-grid opacity-30" />
      <div className="pointer-events-none fixed -left-24 top-16 h-72 w-72 rounded-full bg-signal/15 blur-3xl" />
      <div className="pointer-events-none fixed -right-16 top-40 h-64 w-64 rounded-full bg-azure/10 blur-3xl" />

      <div className="relative mx-auto flex min-h-full max-w-3xl flex-col px-5 pb-16 pt-5 sm:px-8">
        <header className="mb-10 flex items-center justify-between gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] text-[var(--c-muted)] transition hover:bg-[var(--c-hover)] hover:text-[var(--c-text)] hover:-translate-x-0.5"
          >
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            {t('chat.home')}
          </Link>
          <Link
            to="/chat"
            className="rounded-md px-2.5 py-1.5 text-[12px] font-medium text-[var(--c-muted)] transition hover:bg-[var(--c-hover)] hover:text-[var(--c-text)]"
          >
            {t('nav.chat')}
          </Link>
        </header>

        <article className="page-enter flex-1">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-signal">
            {page.eyebrow}
          </p>
          <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--c-text)] sm:text-5xl">
            {page.title}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-[var(--c-muted)] sm:text-lg">
            {page.summary}
          </p>

          <div className="anim-pop mt-10 space-y-6 rounded-2xl border border-[var(--c-border-strong)] bg-[var(--c-elev)] p-6 sm:p-8">
            {page.blocks.map((block, i) => {
              if (block.type === 'p') {
                return (
                  <p key={i} className="text-base leading-relaxed text-[var(--c-muted)]">
                    {block.text}
                  </p>
                );
              }
              if (block.type === 'h2') {
                return (
                  <h2 key={i} className="font-display pt-2 text-xl font-bold text-[var(--c-text)]">
                    {block.text}
                  </h2>
                );
              }
              if (block.type === 'ul') {
                return (
                  <ul key={i} className="space-y-3">
                    {block.items.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-3 text-sm text-[var(--c-muted)] sm:text-base"
                      >
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-sm bg-signal" />
                        {item}
                      </li>
                    ))}
                  </ul>
                );
              }
              if (block.type === 'code') {
                return (
                  <pre
                    key={i}
                    className="overflow-x-auto rounded-xl border border-[var(--c-border)] bg-[var(--c-soft)] p-3 text-[11px] leading-relaxed text-[var(--c-text)] sm:text-[12px]"
                  >
                    <code className="whitespace-pre font-mono">{block.text}</code>
                  </pre>
                );
              }
              return (
                <div key={i} className="pt-2">
                  <Link to={block.to} className="btn-primary">
                    {block.label}
                  </Link>
                </div>
              );
            })}
          </div>
        </article>
      </div>
    </div>
  );
}
