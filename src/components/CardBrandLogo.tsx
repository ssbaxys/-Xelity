import type { CardBrand } from '../lib/cardBrand';

type Props = {
  brand: CardBrand;
  className?: string;
};

/** Компактный логотип платёжной системы для поля номера карты */
export default function CardBrandLogo({ brand, className = 'h-5 w-8' }: Props) {
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
    return (
      <svg className={className} viewBox="0 0 48 32" aria-label="Мир">
        <rect width="48" height="32" rx="4" fill="#0F5C2E" />
        <path d="M8 20V12h3.2l2.4 5.2L16 12h3.2v8H17v-5.1L14.8 20h-1.6L11 14.9V20H8zm14.5 0V12h7.2v2h-4.4v1.2h3.8v2h-3.8V18h4.6v2h-7.4z" fill="#fff" />
        <path d="M34 12h4c2.4 0 4 1.4 4 3.6S40.4 19.2 38 19.2H36.2V20H34V12zm2.2 2v3.2H38c1.2 0 1.8-.6 1.8-1.6S39.2 14 38 14h-1.8z" fill="#00A3E0" />
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
