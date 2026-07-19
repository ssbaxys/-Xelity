import { useEffect, useState } from 'react';

type VersionPayload = {
  buildId?: string;
  client?: string;
};

/**
 * Когда на CDN/VPS выкатили новый билд — показываем «Обновление…» и перезагружаем.
 */
export default function UpdateOverlay() {
  const [updating, setUpdating] = useState(false);
  const localBuild =
    typeof __XELITY_BUILD_ID__ !== 'undefined' ? __XELITY_BUILD_ID__ : '';

  useEffect(() => {
    if (!localBuild) return;

    let cancelled = false;
    let reloading = false;

    const check = async () => {
      if (cancelled || reloading || document.hidden) return;
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`, {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = (await res.json()) as VersionPayload;
        if (!data.buildId || data.buildId === localBuild) return;
        reloading = true;
        setUpdating(true);
        window.setTimeout(() => {
          window.location.reload();
        }, 900);
      } catch {
        /* offline — ignore */
      }
    };

    void check();
    const id = window.setInterval(check, 45_000);
    const onFocus = () => void check();
    const onVis = () => {
      if (!document.hidden) void check();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [localBuild]);

  if (!updating) return null;

  return (
    <div className="xelity-update-overlay" role="status" aria-live="polite">
      <div className="xelity-update-card">
        <div className="xelity-update-spinner" aria-hidden />
        <p className="xelity-update-title">Обновление…</p>
        <p className="xelity-update-sub">Доступна новая версия сайта</p>
      </div>
    </div>
  );
}
