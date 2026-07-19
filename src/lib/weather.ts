/** Типы погоды (совпадают с server/weatherTools) + иконки */

export type WeatherCurrent = {
  tempC: number;
  feelsLikeC: number;
  humidity: number;
  windKmh: number;
  windDir: number;
  precipMm: number;
  code: number;
  label: string;
  isDay: boolean;
};

export type WeatherDay = {
  date: string;
  code: number;
  label: string;
  tempMaxC: number;
  tempMinC: number;
  precipMm: number;
  sunrise?: string;
  sunset?: string;
};

export type WeatherPayload = {
  place: string;
  country?: string;
  admin1?: string;
  latitude: number;
  longitude: number;
  timezone: string;
  updatedAt: string;
  source: 'Open-Meteo';
  current: WeatherCurrent;
  daily: WeatherDay[];
};

export type WeatherIconKind =
  | 'clear'
  | 'mostlyClear'
  | 'partly'
  | 'cloudy'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'snow'
  | 'shower'
  | 'thunder'
  | 'unknown';

export function weatherIconKind(code: number): WeatherIconKind {
  if (code === 0) return 'clear';
  if (code === 1) return 'mostlyClear';
  if (code === 2) return 'partly';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 57) return 'drizzle';
  if (code >= 61 && code <= 67) return 'rain';
  if (code >= 71 && code <= 77) return 'snow';
  if (code >= 80 && code <= 82) return 'shower';
  if (code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'thunder';
  return 'unknown';
}

export function formatWeatherPlace(w: WeatherPayload): string {
  const admin = w.admin1?.trim();
  // «Алтай» без уточнения путают с краем — для карточки оставляем как есть из API
  return [w.place, admin, w.country].filter(Boolean).join(', ');
}

export function weekdayShortRu(isoDate: string): string {
  try {
    const d = new Date(`${isoDate}T12:00:00`);
    return new Intl.DateTimeFormat('ru-RU', { weekday: 'short' }).format(d);
  } catch {
    return isoDate.slice(5);
  }
}

export function dayMonthRu(isoDate: string): string {
  try {
    const d = new Date(`${isoDate}T12:00:00`);
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'short',
    }).format(d);
  } catch {
    return isoDate.slice(5);
  }
}
