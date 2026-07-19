import { useId } from 'react';
import type { WeatherIconKind } from '../lib/weather';

type Props = {
  kind: WeatherIconKind;
  className?: string;
  isDay?: boolean;
};

/** Кастомные цветные SVG-иконки погоды (WMO → kind) */
export default function WeatherIcon({ kind, className = 'h-10 w-10', isDay = true }: Props) {
  const sun = isDay;
  switch (kind) {
    case 'clear':
      return sun ? <IconSun className={className} /> : <IconMoon className={className} />;
    case 'mostlyClear':
      return sun ? <IconSunSmallCloud className={className} /> : <IconMoon className={className} />;
    case 'partly':
      return <IconPartlyCloudy className={className} day={sun} />;
    case 'cloudy':
      return <IconCloudy className={className} />;
    case 'fog':
      return <IconFog className={className} />;
    case 'drizzle':
      return <IconDrizzle className={className} />;
    case 'rain':
      return <IconRain className={className} />;
    case 'shower':
      return <IconShower className={className} />;
    case 'snow':
      return <IconSnow className={className} />;
    case 'thunder':
      return <IconThunder className={className} />;
    default:
      return <IconCloudy className={className} />;
  }
}

function useGid(prefix: string) {
  return `${prefix}-${useId().replace(/:/g, '')}`;
}

function IconSun({ className }: { className?: string }) {
  const gid = useGid('wsun');
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden>
      <circle cx="32" cy="32" r="12" fill="#F5A623" />
      <circle cx="32" cy="32" r="12" fill={`url(#${gid})`} opacity="0.9" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
        const rad = (a * Math.PI) / 180;
        const x1 = 32 + Math.cos(rad) * 18;
        const y1 = 32 + Math.sin(rad) * 18;
        const x2 = 32 + Math.cos(rad) * 26;
        const y2 = 32 + Math.sin(rad) * 26;
        return (
          <line
            key={a}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#F5C542"
            strokeWidth="3"
            strokeLinecap="round"
          />
        );
      })}
      <defs>
        <radialGradient id={gid} cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#FFE08A" />
          <stop offset="100%" stopColor="#E08912" />
        </radialGradient>
      </defs>
    </svg>
  );
}

function IconMoon({ className }: { className?: string }) {
  const gid = useGid('wmoon');
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden>
      <path
        d="M40 12a18 18 0 1 0 10 32 20 20 0 1 1-10-32z"
        fill={`url(#${gid})`}
      />
      <circle cx="46" cy="22" r="1.5" fill="#FFE9A8" opacity="0.8" />
      <circle cx="50" cy="34" r="1" fill="#FFE9A8" opacity="0.7" />
      <defs>
        <linearGradient id={gid} x1="20" y1="10" x2="50" y2="50">
          <stop offset="0%" stopColor="#F5E6A8" />
          <stop offset="100%" stopColor="#C4A35A" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function IconSunSmallCloud({ className }: { className?: string }) {
  const gid = useGid('wcloud1');
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden>
      <circle cx="26" cy="24" r="10" fill="#F5A623" />
      <path
        d="M22 44h24a10 10 0 0 0 1-20 12 12 0 0 0-23-3A9 9 0 0 0 22 44z"
        fill={`url(#${gid})`}
      />
      <defs>
        <linearGradient id={gid} x1="18" y1="28" x2="48" y2="48">
          <stop offset="0%" stopColor="#F2F6FA" />
          <stop offset="100%" stopColor="#B8C4D4" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function IconPartlyCloudy({ className, day }: { className?: string; day: boolean }) {
  const gid = useGid('wcloud2');
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden>
      {day ? (
        <circle cx="22" cy="22" r="9" fill="#F5A623" />
      ) : (
        <path d="M28 14a12 12 0 1 0 6 22 14 14 0 1 1-6-22z" fill="#E8D48B" />
      )}
      <path
        d="M20 46h28a11 11 0 0 0 1.2-22 13 13 0 0 0-25-2.5A10 10 0 0 0 20 46z"
        fill={`url(#${gid})`}
      />
      <defs>
        <linearGradient id={gid} x1="16" y1="30" x2="52" y2="50">
          <stop offset="0%" stopColor="#EEF3F8" />
          <stop offset="100%" stopColor="#9AA8BA" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function IconCloudy({ className }: { className?: string }) {
  const gid = useGid('wcloud3');
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden>
      <path
        d="M18 44h30a12 12 0 0 0 1-24 14 14 0 0 0-27-3A11 11 0 0 0 18 44z"
        fill={`url(#${gid})`}
      />
      <defs>
        <linearGradient id={gid} x1="14" y1="26" x2="52" y2="48">
          <stop offset="0%" stopColor="#D5DCE6" />
          <stop offset="100%" stopColor="#7A8799" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function IconFog({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden>
      <path
        d="M20 30h26a9 9 0 0 0 .8-18 11 11 0 0 0-21-2A8 8 0 0 0 20 30z"
        fill="#C5CED8"
        opacity="0.85"
      />
      {[36, 42, 48, 54].map((y, i) => (
        <line
          key={y}
          x1={14 + (i % 2) * 4}
          y1={y}
          x2={50 - (i % 2) * 4}
          y2={y}
          stroke="#A8B4C2"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity={0.7 - i * 0.1}
        />
      ))}
    </svg>
  );
}

function IconDrizzle({ className }: { className?: string }) {
  const gid = useGid('wcloud4');
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden>
      <path
        d="M18 34h28a10 10 0 0 0 1-20 12 12 0 0 0-23-2.5A9 9 0 0 0 18 34z"
        fill={`url(#${gid})`}
      />
      {[22, 32, 42].map((x) => (
        <line
          key={x}
          x1={x}
          y1="40"
          x2={x - 2}
          y2="52"
          stroke="#5BA3E0"
          strokeWidth="2"
          strokeLinecap="round"
        />
      ))}
      <defs>
        <linearGradient id={gid} x1="16" y1="18" x2="48" y2="36">
          <stop offset="0%" stopColor="#E8EEF5" />
          <stop offset="100%" stopColor="#8A97A8" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function IconRain({ className }: { className?: string }) {
  const gid = useGid('wcloud5');
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden>
      <path
        d="M16 32h32a11 11 0 0 0 1-22 13 13 0 0 0-25-2.8A10 10 0 0 0 16 32z"
        fill={`url(#${gid})`}
      />
      {[20, 28, 36, 44].map((x, i) => (
        <line
          key={x}
          x1={x}
          y1={38 + (i % 2)}
          x2={x - 3}
          y2="54"
          stroke="#3B8DD9"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      ))}
      <defs>
        <linearGradient id={gid} x1="14" y1="14" x2="50" y2="34">
          <stop offset="0%" stopColor="#D0D8E4" />
          <stop offset="100%" stopColor="#5C6B7E" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function IconShower({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden>
      <circle cx="20" cy="20" r="7" fill="#F5A623" opacity="0.85" />
      <path
        d="M18 36h30a10 10 0 0 0 1-20 12 12 0 0 0-23-2A9 9 0 0 0 18 36z"
        fill="#9AA8BA"
      />
      {[24, 34, 44].map((x) => (
        <path
          key={x}
          d={`M${x} 42c0 0-2 6-2 10`}
          stroke="#2E86DE"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

function IconSnow({ className }: { className?: string }) {
  const gid = useGid('wcloud6');
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden>
      <path
        d="M16 32h32a11 11 0 0 0 1-22 13 13 0 0 0-25-2.8A10 10 0 0 0 16 32z"
        fill={`url(#${gid})`}
      />
      {[22, 32, 42].map((x, i) => (
        <g key={x} transform={`translate(${x} ${42 + (i % 2) * 4})`}>
          <line x1="0" y1="-5" x2="0" y2="5" stroke="#A8D4F0" strokeWidth="1.8" />
          <line x1="-4" y1="-3" x2="4" y2="3" stroke="#A8D4F0" strokeWidth="1.8" />
          <line x1="-4" y1="3" x2="4" y2="-3" stroke="#A8D4F0" strokeWidth="1.8" />
        </g>
      ))}
      <defs>
        <linearGradient id={gid} x1="14" y1="14" x2="50" y2="34">
          <stop offset="0%" stopColor="#F0F4F8" />
          <stop offset="100%" stopColor="#8FA0B5" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function IconThunder({ className }: { className?: string }) {
  const gid = useGid('wcloud7');
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden>
      <path
        d="M14 30h34a11 11 0 0 0 1-22 13 13 0 0 0-26-2A10 10 0 0 0 14 30z"
        fill={`url(#${gid})`}
      />
      <path
        d="M34 34l-8 12h7l-3 12 12-16h-7l5-8z"
        fill="#F5C542"
        stroke="#E08912"
        strokeWidth="0.5"
      />
      <defs>
        <linearGradient id={gid} x1="12" y1="12" x2="50" y2="32">
          <stop offset="0%" stopColor="#6B7788" />
          <stop offset="100%" stopColor="#2F3640" />
        </linearGradient>
      </defs>
    </svg>
  );
}
