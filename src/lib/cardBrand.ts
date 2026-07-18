/** Определение платёжной системы по BIN / префиксу номера */

export type CardBrand =
  | 'mir'
  | 'visa'
  | 'mastercard'
  | 'maestro'
  | 'amex'
  | 'unionpay'
  | 'unknown';

export function onlyCardDigits(value: string): string {
  return value.replace(/\D/g, '');
}

export function formatCardNumber(value: string): string {
  const d = onlyCardDigits(value).slice(0, 19);
  // Amex: 4-6-5
  if (/^3[47]/.test(d)) {
    const a = d.slice(0, 4);
    const b = d.slice(4, 10);
    const c = d.slice(10, 15);
    return [a, b, c].filter(Boolean).join(' ');
  }
  return d.replace(/(\d{4})(?=\d)/g, '$1 ').trim();
}

export function detectCardBrand(digitsOrFormatted: string): CardBrand {
  const d = onlyCardDigits(digitsOrFormatted);
  if (!d) return 'unknown';

  // МИР: 2200–2204
  if (/^220[0-4]/.test(d)) return 'mir';

  // American Express: 34, 37
  if (/^3[47]/.test(d)) return 'amex';

  // UnionPay: 62
  if (/^62/.test(d)) return 'unionpay';

  // Mastercard: 51–55, 2221–2720
  if (/^5[1-5]/.test(d)) return 'mastercard';
  if (/^2(22[1-9]|2[3-9]\d|[3-6]\d{2}|7[01]\d|720)/.test(d)) return 'mastercard';

  // Visa: 4
  if (/^4/.test(d)) return 'visa';

  // Maestro: 50, 56–69 (после более специфичных префиксов)
  if (/^(50|5[6-9]|6\d)/.test(d)) return 'maestro';

  return 'unknown';
}

export function cardBrandLabel(brand: CardBrand): string {
  switch (brand) {
    case 'mir':
      return 'Мир';
    case 'visa':
      return 'Visa';
    case 'mastercard':
      return 'Mastercard';
    case 'maestro':
      return 'Maestro';
    case 'amex':
      return 'American Express';
    case 'unionpay':
      return 'UnionPay';
    default:
      return 'Карта';
  }
}

/** Ожидаемая длина номера (для валидации формы) */
export function cardNumberLength(brand: CardBrand): { min: number; max: number } {
  if (brand === 'amex') return { min: 15, max: 15 };
  if (brand === 'mir') return { min: 16, max: 16 };
  return { min: 13, max: 19 };
}

export type ExpiryCheck = {
  /** поле ещё неполное — не ругаемся */
  incomplete: boolean;
  ok: boolean;
  month: number | null;
  year: number | null;
  message: string | null;
};

/**
 * Проверка срока MM/YY или MMYY.
 * Карта действует до конца указанного месяца.
 */
export function validateCardExpiry(
  value: string,
  now = new Date(),
): ExpiryCheck {
  const d = onlyCardDigits(value).slice(0, 4);
  if (d.length < 4) {
    return { incomplete: true, ok: false, month: null, year: null, message: null };
  }

  const month = Number(d.slice(0, 2));
  const yy = Number(d.slice(2, 4));
  if (!Number.isFinite(month) || !Number.isFinite(yy)) {
    return {
      incomplete: false,
      ok: false,
      month: null,
      year: null,
      message: 'Некорректный срок',
    };
  }

  if (month < 1 || month > 12) {
    return {
      incomplete: false,
      ok: false,
      month,
      year: 2000 + yy,
      message: 'Месяц должен быть от 01 до 12',
    };
  }

  const year = 2000 + yy;
  // срок до конца месяца: сравниваем с первым днём следующего месяца
  const expiresEnd = new Date(year, month, 1); // 1-е число следующего месяца после expiry
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  if (expiresEnd <= currentMonthStart) {
    return {
      incomplete: false,
      ok: false,
      month,
      year,
      message: 'Срок действия карты истёк',
    };
  }

  // слишком далёкий год (> 20 лет) — подозрительно
  if (year > now.getFullYear() + 20) {
    return {
      incomplete: false,
      ok: false,
      month,
      year,
      message: 'Слишком далёкий год',
    };
  }

  return {
    incomplete: false,
    ok: true,
    month,
    year,
    message: null,
  };
}

export function formatCardExpiry(value: string): string {
  let d = onlyCardDigits(value).slice(0, 4);
  // 2–9 в первой позиции → 0X
  if (d.length === 1 && Number(d) > 1) {
    d = `0${d}`;
  }
  if (d.length >= 2) {
    let mm = d.slice(0, 2);
    const mNum = Number(mm);
    if (mNum === 0) mm = '01';
    else if (mNum > 12) mm = '12';
    const yy = d.slice(2);
    return yy.length ? `${mm}/${yy}` : `${mm}/`;
  }
  return d;
}
