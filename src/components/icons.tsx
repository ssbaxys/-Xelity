type IconProps = { className?: string };

export function IconMenu({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h10" />
    </svg>
  );
}

export function IconPlus({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconFolder({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 7.5A1.5 1.5 0 014.5 6h4.379a1.5 1.5 0 011.06.44l1.122 1.12A1.5 1.5 0 0012.122 8H19.5A1.5 1.5 0 0121 9.5v8A1.5 1.5 0 0119.5 19h-15A1.5 1.5 0 013 17.5v-10z"
      />
    </svg>
  );
}

export function IconChevronDown({ className = 'h-3.5 w-3.5' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function IconChevronRight({ className = 'h-3.5 w-3.5' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
    </svg>
  );
}

export function IconMore({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="12" cy="5" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="12" cy="19" r="1.5" />
    </svg>
  );
}

export function IconPencil({ className = 'h-3.5 w-3.5' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.862 3.487a2.1 2.1 0 012.97 2.97L8.25 18.04 3 19.5l1.46-5.25L16.862 3.487z"
      />
    </svg>
  );
}

export function IconClose({ className = 'h-3.5 w-3.5' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function IconPin({ className = 'h-3 w-3' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M14.5 3.5l6 6-2.2.7-3.1 3.1V19l-2.7-2.7L8.2 20.5 3.5 15.8l4.1-4.3L4.9 8.8l.7-2.2 6-6 2.9 2.9z" />
    </svg>
  );
}

export function IconSearch({ className = 'h-3.5 w-3.5' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <circle cx="11" cy="11" r="6.5" />
      <path strokeLinecap="round" d="M16.5 16.5L21 21" />
    </svg>
  );
}

export function IconSend({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

export function IconRefresh({ className = 'h-3.5 w-3.5' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 12a8 8 0 0113.66-5.66M20 12a8 8 0 01-13.66 5.66" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M17.5 4.5V8H14M6.5 19.5V16H10" />
    </svg>
  );
}

export function IconUndo({ className = 'h-3.5 w-3.5' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 14L4 9l5-5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 9h10.5a5.5 5.5 0 110 11H12" />
    </svg>
  );
}

export function IconWand({ className = 'h-3.5 w-3.5' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 4V2m0 14v-2M8 9h2m10 0h2M5.5 5.5l1.5 1.5M17 17l1.5 1.5M5.5 18.5L7 17M17 7l1.5-1.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 15l-6 6m8.5-8.5L15 9l3.5-6.5L15 6l-3.5 6.5L9 15z" />
    </svg>
  );
}

export function IconCopy({ className = 'h-3 w-3' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path strokeLinecap="round" d="M6 16V6a2 2 0 012-2h10" />
    </svg>
  );
}

export function IconChat({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 6.5A2.5 2.5 0 017.5 4h9A2.5 2.5 0 0119 6.5v6A2.5 2.5 0 0116.5 15H10l-4 4v-4H7.5A2.5 2.5 0 015 12.5v-6z"
      />
    </svg>
  );
}

/** Пустой список / нет чатов */
export function IconEmpty({ className = 'h-8 w-8' }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M7.5 4h9A2.5 2.5 0 0119 6.5v6A2.5 2.5 0 0116.5 15H10l-4 4v-4H7.5A2.5 2.5 0 015 12.5v-6A2.5 2.5 0 017.5 4z" />
      <path d="M9 9.5h6M9 12.5h3.5" opacity="0.35" />
      <circle cx="17.5" cy="6.5" r="3.2" fill="currentColor" fillOpacity="0.08" stroke="currentColor" />
      <path d="M16.3 6.5h2.4M17.5 5.3v2.4" />
    </svg>
  );
}

export function IconTrash({ className = 'h-3.5 w-3.5' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 8h14M9 8V6.5A1.5 1.5 0 0110.5 5h3A1.5 1.5 0 0115 6.5V8m-7 0l.8 11.2A1.5 1.5 0 0010.3 21h3.4a1.5 1.5 0 001.5-1.8L16 8"
      />
    </svg>
  );
}

export function IconCheck({ className = 'h-3 w-3' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function IconSettings({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

export function IconExport({ className = 'h-3.5 w-3.5' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v10m0 0l-3.5-3.5M12 14l3.5-3.5M5 18h14" />
    </svg>
  );
}

export function IconDuplicate({ className = 'h-3.5 w-3.5' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <rect x="8" y="8" width="11" height="11" rx="2" />
      <path strokeLinecap="round" d="M6 15V6a2 2 0 012-2h9" />
    </svg>
  );
}

export function IconGrip({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <circle cx="5" cy="3.5" r="1.15" />
      <circle cx="11" cy="3.5" r="1.15" />
      <circle cx="5" cy="8" r="1.15" />
      <circle cx="11" cy="8" r="1.15" />
      <circle cx="5" cy="12.5" r="1.15" />
      <circle cx="11" cy="12.5" r="1.15" />
    </svg>
  );
}

export function IconFolderOut({ className = 'h-3.5 w-3.5' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8h6l2 2h10v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 13h5m0 0l-2-2m2 2l-2 2" />
    </svg>
  );
}

export function IconUser({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 7.5a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.5 19.5a7.5 7.5 0 0115 0"
      />
    </svg>
  );
}

export function IconLogout({ className = 'h-3.5 w-3.5' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6A2.25 2.25 0 005.25 5.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 12h8.25m0 0l-3-3m3 3l-3 3" />
    </svg>
  );
}

export function IconLimits({ className = 'h-3.5 w-3.5' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 6.75h15M4.5 12h15M4.5 17.25h15" />
      <circle cx="8.25" cy="6.75" r="1.35" fill="currentColor" stroke="none" />
      <circle cx="14.25" cy="12" r="1.35" fill="currentColor" stroke="none" />
      <circle cx="10.5" cy="17.25" r="1.35" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconPricing({ className = 'h-3.5 w-3.5' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15A2.25 2.25 0 002.25 6.75v10.5A2.25 2.25 0 004.5 19.5z"
      />
    </svg>
  );
}

export function IconSupport({ className = 'h-3.5 w-3.5' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z"
      />
    </svg>
  );
}

export function IconAdmin({ className = 'h-3.5 w-3.5' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z"
      />
    </svg>
  );
}

export function IconSun({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <circle cx="12" cy="12" r="3.5" />
      <path
        strokeLinecap="round"
        d="M12 3.5v1.5M12 19v1.5M3.5 12H5M19 12h1.5M6.2 6.2l1.1 1.1M16.7 16.7l1.1 1.1M6.2 17.8l1.1-1.1M16.7 7.3l1.1-1.1"
      />
    </svg>
  );
}

export function IconMoon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M20.5 14.2A8.2 8.2 0 0110 3.7a8.3 8.3 0 1010.5 10.5z"
      />
    </svg>
  );
}

export function IconBrain({ className = 'h-3.5 w-3.5' }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {/* Симметричный мозг, центр viewBox 12×12 */}
      <path d="M12 4.5a3.2 3.2 0 0 0-3.15 2.55 3.8 3.8 0 0 0-2.6 3.55c0 1.35.7 2.55 1.75 3.2A3.5 3.5 0 0 0 12 19.5" />
      <path d="M12 4.5a3.2 3.2 0 0 1 3.15 2.55 3.8 3.8 0 0 1 2.6 3.55c0 1.35-.7 2.55-1.75 3.2A3.5 3.5 0 0 1 12 19.5" />
      <path d="M12 8v7.5" />
      <path d="M9.2 10.2c.8-.7 1.7-1 2.8-1s2 .3 2.8 1" />
      <path d="M9.5 13.2c.7.5 1.5.8 2.5.8s1.8-.3 2.5-.8" />
    </svg>
  );
}

export function IconCode({ className = 'h-3.5 w-3.5' }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M8.5 7.5 4 12l4.5 4.5" />
      <path d="M15.5 7.5 20 12l-4.5 4.5" />
      <path d="M13.2 5.5 10.8 18.5" />
    </svg>
  );
}

export function IconEye({ className = 'h-3.5 w-3.5' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

export function IconFilePlus({ className = 'h-3.5 w-3.5' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" />
      <path strokeLinecap="round" d="M14 3v5h5M12 11v6M9 14h6" />
    </svg>
  );
}

export function IconFileCode({ className = 'h-3.5 w-3.5' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" />
      <path strokeLinecap="round" d="M14 3v5h5M10 13l-2 2 2 2M14 13l2 2-2 2" />
    </svg>
  );
}
