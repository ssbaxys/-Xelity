import { useEffect, useState } from 'react';
import { formatCountdown } from '../lib/plans';

type Props = {
  expiresAt: number | null;
  className?: string;
  prefix?: string;
};

export default function PlanCountdown({
  expiresAt,
  className = '',
  prefix = 'осталось',
}: Props) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [expiresAt]);

  if (!expiresAt) return null;
  const left = expiresAt - now;
  const urgent = left > 0 && left < 3 * 24 * 60 * 60 * 1000;

  return (
    <span className={`${urgent ? 'text-[#e57373]' : ''} ${className}`.trim()}>
      {left <= 0
        ? 'тариф истёк'
        : prefix
          ? `${prefix} ${formatCountdown(left)}`
          : formatCountdown(left)}
    </span>
  );
}
