/** Оверлей сборки: чёрный экран, дым, крутящийся reload */

type Props = {
  active: boolean;
  background?: boolean;
};

function ReloadIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}

export default function SiteDevelopingOverlay({ active, background }: Props) {
  if (!active && !background) return null;

  return (
    <div
      className={`site-dev-overlay ${active ? 'is-active' : ''} ${background ? 'is-bg' : ''}`}
      role="status"
      aria-live="polite"
    >
      <div className="site-dev-smoke" aria-hidden>
        <span className="site-dev-puff site-dev-puff-a" />
        <span className="site-dev-puff site-dev-puff-b" />
        <span className="site-dev-puff site-dev-puff-c" />
        <span className="site-dev-puff site-dev-puff-d" />
      </div>

      <div className="site-dev-card">
        <div className="site-dev-reload-wrap" aria-hidden>
          <ReloadIcon className="site-dev-reload" />
        </div>
        <p className="site-dev-title">
          {background ? 'Сборка идёт в фоне' : 'Собираем сайт'}
        </p>
        <p className="site-dev-sub">
          {background
            ? 'Актуальная версия обновляется — вы смотрите прошлую сборку'
            : 'Превью откроется, когда сборка будет готова'}
        </p>
      </div>
    </div>
  );
}
