import { useId } from 'react';
import type { CardBrand } from '../lib/cardBrand';

type Props = {
  brand: CardBrand;
  className?: string;
};

/** Компактный логотип платёжной системы для поля номера карты */
export default function CardBrandLogo({ brand, className = 'h-5 w-8' }: Props) {
  const uid = useId().replace(/:/g, '');

  if (brand === 'unknown') {
    return (
      <svg className={className} viewBox="0 0 32 20" aria-hidden>
        <rect x="0.5" y="0.5" width="31" height="19" rx="3" fill="none" stroke="currentColor" strokeOpacity="0.35" />
        <rect x="4" y="5" width="10" height="3" rx="1" fill="currentColor" fillOpacity="0.25" />
        <rect x="4" y="11" width="24" height="2" rx="1" fill="currentColor" fillOpacity="0.2" />
      </svg>
    );
  }

  if (brand === 'visa') {
    return (
      <svg className={className} viewBox="0 0 48 32" aria-label="Visa">
        <rect width="48" height="32" rx="4" fill="#1A1F71" />
        <text
          x="24"
          y="21"
          textAnchor="middle"
          fill="#fff"
          fontFamily="Arial, sans-serif"
          fontWeight="700"
          fontSize="12"
          fontStyle="italic"
        >
          VISA
        </text>
      </svg>
    );
  }

  if (brand === 'mastercard') {
    return (
      <svg className={className} viewBox="0 0 48 32" aria-label="Mastercard">
        <rect width="48" height="32" rx="4" fill="#111" />
        <circle cx="19" cy="16" r="8" fill="#EB001B" />
        <circle cx="29" cy="16" r="8" fill="#F79E1B" />
        <path d="M24 10.2a8 8 0 000 11.6 8 8 0 000-11.6z" fill="#FF5F00" />
      </svg>
    );
  }

  if (brand === 'mir') {
    const gradId = `mir-grad-${uid}`;
    // Тот же бокс 48×32, что у Visa/MC — белый фон + логотип внутри
    return (
      <svg className={className} viewBox="0 0 48 32" aria-label="Мир">
        <rect width="48" height="32" rx="4" fill="#fff" stroke="#e5e5e5" strokeWidth="0.5" />
        <defs>
          <linearGradient id={gradId} x1="370" x2="290" gradientUnits="userSpaceOnUse">
            <stop stopColor="#1F5CD7" />
            <stop stopColor="#02AEFF" offset="1" />
          </linearGradient>
        </defs>
        <g transform="translate(3.5 11) scale(0.1025)">
          <path
            d="m31 13h33c3 0 12-1 16 13 3 9 7 23 13 44h2c6-22 11-37 13-44 4-14 14-13 18-13h31v96h-32v-57h-2l-17 57h-24l-17-57h-3v57h-31m139-96h32v57h3l21-47c4-9 13-10 13-10h30v96h-32v-57h-2l-21 47c-4 9-14 10-14 10h-30m142-29v29h-30v-50h98c-4 12-18 21-34 21"
            fill="#0f754e"
          />
          <path
            d="m382 53c4-18-8-40-34-40h-68c2 21 20 40 39 40"
            fill={`url(#${gradId})`}
          />
        </g>
      </svg>
    );
  }

  if (brand === 'maestro') {
    return (
      <svg className={className} viewBox="0 0 48 32" aria-label="Maestro">
        <rect width="48" height="32" rx="4" fill="#000" />
        <circle cx="19" cy="16" r="8" fill="#0099DF" />
        <circle cx="29" cy="16" r="8" fill="#ED0006" />
        <path d="M24 10.2a8 8 0 000 11.6 8 8 0 000-11.6z" fill="#6C6BBD" />
      </svg>
    );
  }

  if (brand === 'amex') {
    return (
      <svg className={className} viewBox="0 0 48 32" aria-label="American Express">
        <rect width="48" height="32" rx="4" fill="#2E77BC" />
        <text
          x="24"
          y="20"
          textAnchor="middle"
          fill="#fff"
          fontFamily="Arial, sans-serif"
          fontWeight="700"
          fontSize="8"
          letterSpacing="0.5"
        >
          AMEX
        </text>
      </svg>
    );
  }

  // unionpay
  return (
    <svg className={className} viewBox="0 0 48 32" aria-label="UnionPay">
      <rect width="48" height="32" rx="4" fill="#fff" stroke="#ddd" />
      <rect x="6" y="8" width="10" height="16" rx="1" fill="#E21836" />
      <rect x="19" y="8" width="10" height="16" rx="1" fill="#00447C" />
      <rect x="32" y="8" width="10" height="16" rx="1" fill="#007B84" />
    </svg>
  );
}
