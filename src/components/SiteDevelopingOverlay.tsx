/** Оверлей «сайт в разработке» поверх превью */

type Props = {
  active: boolean;
  background?: boolean;
};

export default function SiteDevelopingOverlay({ active, background }: Props) {
  if (!active && !background) return null;

  return (
    <div
      className={`site-dev-overlay ${active ? 'is-active' : ''} ${background ? 'is-bg' : ''}`}
      role="status"
      aria-live="polite"
    >
      <div className="site-dev-card">
        <div className="site-dev-orbit" aria-hidden>
          <span className="site-dev-ring" />
          <span className="site-dev-ring site-dev-ring-2" />
          <span className="site-dev-core" />
          <span className="site-dev-dot site-dev-dot-a" />
          <span className="site-dev-dot site-dev-dot-b" />
          <span className="site-dev-dot site-dev-dot-c" />
        </div>
        <p className="site-dev-title">
          {background ? 'Сборка идёт в фоне' : 'Сайт обновляется'}
        </p>
        <p className="site-dev-sub">
          {background
            ? 'Рабочая версия меняется, пока вы смотрите прошлую сборку'
            : 'Вносим правки в макет и код — превью обновится через мгновение'}
        </p>
        <div className="site-dev-bars" aria-hidden>
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}
