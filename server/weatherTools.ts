/**
 * Погода через Open-Meteo (бесплатно, без ключа, глобально, модели ECMWF/GFS и др.)
 * https://open-meteo.com/
 */

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

export type WeatherToolResult = {
  ok: boolean;
  forModel: string;
  summary?: string;
  error?: string;
  weather?: WeatherPayload;
};

const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

/** WMO Weather interpretation codes → короткий label (ru) */
export function wmoLabel(code: number): string {
  if (code === 0) return 'Ясно';
  if (code === 1) return 'Преимущественно ясно';
  if (code === 2) return 'Переменная облачность';
  if (code === 3) return 'Пасмурно';
  if (code === 45 || code === 48) return 'Туман';
  if (code >= 51 && code <= 55) return 'Морось';
  if (code === 56 || code === 57) return 'Ледяная морось';
  if (code >= 61 && code <= 65) return 'Дождь';
  if (code === 66 || code === 67) return 'Ледяной дождь';
  if (code >= 71 && code <= 77) return 'Снег';
  if (code >= 80 && code <= 82) return 'Ливень';
  if (code === 85 || code === 86) return 'Снегопад';
  if (code === 95) return 'Гроза';
  if (code === 96 || code === 99) return 'Гроза с градом';
  return 'Переменная погода';
}

async function fetchJson<T>(url: string, timeoutMs = 10_000): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(t);
  }
}

type GeoHit = {
  name: string;
  country?: string;
  admin1?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
};

async function geocode(location: string): Promise<GeoHit | null> {
  const q = location.trim().slice(0, 120);
  if (!q) return null;
  const url = `${GEO_URL}?${new URLSearchParams({
    name: q,
    count: '1',
    language: 'ru',
    format: 'json',
  })}`;
  const data = await fetchJson<{ results?: GeoHit[] }>(url);
  return data.results?.[0] ?? null;
}

type ForecastResp = {
  timezone?: string;
  current?: {
    time?: string;
    temperature_2m?: number;
    relative_humidity_2m?: number;
    apparent_temperature?: number;
    precipitation?: number;
    weather_code?: number;
    wind_speed_10m?: number;
    wind_direction_10m?: number;
    is_day?: number;
  };
  daily?: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    precipitation_sum?: number[];
    sunrise?: string[];
    sunset?: string[];
  };
};

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

export async function executeGetWeather(args: {
  location?: string;
  latitude?: number;
  longitude?: number;
  days?: number;
}): Promise<WeatherToolResult> {
  try {
    let lat = typeof args.latitude === 'number' ? args.latitude : NaN;
    let lon = typeof args.longitude === 'number' ? args.longitude : NaN;
    let place = '';
    let country: string | undefined;
    let admin1: string | undefined;
    let tzHint: string | undefined;

    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      place = args.location?.trim() || `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
    } else {
      const loc = (args.location || '').trim();
      if (!loc) {
        return {
          ok: false,
          forModel: 'get_weather: укажи location (город) или latitude+longitude',
          error: 'Нужен город или координаты',
        };
      }
      const geo = await geocode(loc);
      if (!geo) {
        return {
          ok: false,
          forModel: `get_weather: место «${loc}» не найдено`,
          error: 'Место не найдено',
        };
      }
      lat = geo.latitude;
      lon = geo.longitude;
      place = geo.name;
      country = geo.country;
      admin1 = geo.admin1;
      tzHint = geo.timezone;
    }

    const days = Math.min(7, Math.max(1, Math.floor(args.days ?? 7)));
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      timezone: 'auto',
      forecast_days: String(days),
      current: [
        'temperature_2m',
        'relative_humidity_2m',
        'apparent_temperature',
        'precipitation',
        'weather_code',
        'wind_speed_10m',
        'wind_direction_10m',
        'is_day',
      ].join(','),
      daily: [
        'weather_code',
        'temperature_2m_max',
        'temperature_2m_min',
        'precipitation_sum',
        'sunrise',
        'sunset',
      ].join(','),
      wind_speed_unit: 'kmh',
    });

    const fc = await fetchJson<ForecastResp>(`${FORECAST_URL}?${params}`);
    const cur = fc.current;
    if (!cur || cur.temperature_2m == null || cur.weather_code == null) {
      return {
        ok: false,
        forModel: 'get_weather: пустой ответ Open-Meteo',
        error: 'Нет данных',
      };
    }

    const code = Number(cur.weather_code);
    const weather: WeatherPayload = {
      place,
      country,
      admin1,
      latitude: lat,
      longitude: lon,
      timezone: fc.timezone || tzHint || 'auto',
      updatedAt: cur.time || new Date().toISOString(),
      source: 'Open-Meteo',
      current: {
        tempC: round1(cur.temperature_2m),
        feelsLikeC: round1(cur.apparent_temperature ?? cur.temperature_2m),
        humidity: Math.round(cur.relative_humidity_2m ?? 0),
        windKmh: round1(cur.wind_speed_10m ?? 0),
        windDir: Math.round(cur.wind_direction_10m ?? 0),
        precipMm: round1(cur.precipitation ?? 0),
        code,
        label: wmoLabel(code),
        isDay: cur.is_day !== 0,
      },
      daily: (fc.daily?.time || []).map((date, i) => {
        const dCode = Number(fc.daily?.weather_code?.[i] ?? 0);
        return {
          date,
          code: dCode,
          label: wmoLabel(dCode),
          tempMaxC: round1(fc.daily?.temperature_2m_max?.[i] ?? 0),
          tempMinC: round1(fc.daily?.temperature_2m_min?.[i] ?? 0),
          precipMm: round1(fc.daily?.precipitation_sum?.[i] ?? 0),
          sunrise: fc.daily?.sunrise?.[i],
          sunset: fc.daily?.sunset?.[i],
        };
      }),
    };

    const where = [place, admin1, country].filter(Boolean).join(', ');
    const forModel = [
      `WEATHER (Open-Meteo) for ${where}`,
      `Coords: ${lat.toFixed(4)}, ${lon.toFixed(4)} · TZ: ${weather.timezone}`,
      `Updated: ${weather.updatedAt}`,
      `Now: ${weather.current.tempC}°C (feels ${weather.current.feelsLikeC}°C), ${weather.current.label}, humidity ${weather.current.humidity}%, wind ${weather.current.windKmh} km/h, precip ${weather.current.precipMm} mm`,
      'Daily:',
      ...weather.daily.map(
        (d) =>
          `- ${d.date}: ${d.tempMinC}…${d.tempMaxC}°C, ${d.label}, precip ${d.precipMm} mm`,
      ),
      '',
      'UI already shows an interactive weather card from this tool result.',
      'In your reply: short summary for the user; do not invent other temperatures.',
    ].join('\n');

    return {
      ok: true,
      forModel,
      summary: `${where}: ${weather.current.tempC}°C`,
      weather,
    };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.name === 'AbortError'
          ? 'таймаут'
          : err.message
        : 'ошибка';
    return {
      ok: false,
      forModel: `get_weather failed: ${message}`,
      error: message,
    };
  }
}
