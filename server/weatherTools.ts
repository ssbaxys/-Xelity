/**
 * Погода через Open-Meteo (бесплатно, без ключа, глобально).
 * Геокодинг: нормализация запроса + несколько вариантов + выбор лучшего hit
 * + fallback Nominatim для мелких населённых пунктов РФ.
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
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';

/** Ручные алиасы для мест, которые геокодеры часто не находят с опечатками */
const PLACE_ALIASES: Record<
  string,
  { name: string; admin1?: string; country?: string; latitude: number; longitude: number; timezone?: string }
> = {
  'усть-кокса': {
    name: 'Усть-Кокса',
    admin1: 'Республика Алтай',
    country: 'Россия',
    latitude: 50.2697,
    longitude: 85.6108,
    timezone: 'Asia/Barnaul',
  },
  'усть кокса': {
    name: 'Усть-Кокса',
    admin1: 'Республика Алтай',
    country: 'Россия',
    latitude: 50.2697,
    longitude: 85.6108,
    timezone: 'Asia/Barnaul',
  },
  'ust-koksa': {
    name: 'Усть-Кокса',
    admin1: 'Республика Алтай',
    country: 'Россия',
    latitude: 50.2697,
    longitude: 85.6108,
    timezone: 'Asia/Barnaul',
  },
  'ust koksa': {
    name: 'Усть-Кокса',
    admin1: 'Республика Алтай',
    country: 'Россия',
    latitude: 50.2697,
    longitude: 85.6108,
    timezone: 'Asia/Barnaul',
  },
  'горно-алтайск': {
    name: 'Горно-Алтайск',
    admin1: 'Республика Алтай',
    country: 'Россия',
    latitude: 51.9581,
    longitude: 85.9603,
    timezone: 'Asia/Barnaul',
  },
  москва: {
    name: 'Москва',
    admin1: 'Москва',
    country: 'Россия',
    latitude: 55.7558,
    longitude: 37.6173,
    timezone: 'Europe/Moscow',
  },
  moscow: {
    name: 'Москва',
    admin1: 'Москва',
    country: 'Россия',
    latitude: 55.7558,
    longitude: 37.6173,
    timezone: 'Europe/Moscow',
  },
  'санкт-петербург': {
    name: 'Санкт-Петербург',
    admin1: 'Санкт-Петербург',
    country: 'Россия',
    latitude: 59.9343,
    longitude: 30.3351,
    timezone: 'Europe/Moscow',
  },
  'санкт петербург': {
    name: 'Санкт-Петербург',
    admin1: 'Санкт-Петербург',
    country: 'Россия',
    latitude: 59.9343,
    longitude: 30.3351,
    timezone: 'Europe/Moscow',
  },
  петербург: {
    name: 'Санкт-Петербург',
    admin1: 'Санкт-Петербург',
    country: 'Россия',
    latitude: 59.9343,
    longitude: 30.3351,
    timezone: 'Europe/Moscow',
  },
  питер: {
    name: 'Санкт-Петербург',
    admin1: 'Санкт-Петербург',
    country: 'Россия',
    latitude: 59.9343,
    longitude: 30.3351,
    timezone: 'Europe/Moscow',
  },
  новосибирск: {
    name: 'Новосибирск',
    admin1: 'Новосибирская область',
    country: 'Россия',
    latitude: 55.0084,
    longitude: 82.9357,
    timezone: 'Asia/Novosibirsk',
  },
  барнаул: {
    name: 'Барнаул',
    admin1: 'Алтайский край',
    country: 'Россия',
    latitude: 53.3606,
    longitude: 83.7636,
    timezone: 'Asia/Barnaul',
  },
};

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

async function fetchJson<T>(url: string, timeoutMs = 10_000, headers?: Record<string, string>): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json', ...(headers || {}) },
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
  country_code?: string;
  admin1?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
  population?: number;
};

function stripWeatherNoise(q: string): string {
  return q
    .replace(
      /^(какая|какой|какое|скажи|покажи|дай|узнай|проверь)\s+/giu,
      '',
    )
    .replace(
      /^(погода|прогноз|weather|forecast|температура)\s+(в|во|на|для|у|около)?\s*/giu,
      '',
    )
    .replace(
      /\s+(погода|прогноз|weather|сейчас|сегодня|завтра)$/giu,
      '',
    )
    .replace(/^(в|во|на|для|у|около|про)\s+/giu, '')
    // «лего» / «для» из голосового / опечаток перед названием
    .replace(/^(лего|дляо|для)\s+/giu, '')
    .trim();
}

/** Мягкая нормализация падежей только для последнего слова (коксу→кокса). */
function softenRussianPlace(q: string): string {
  const s = q.trim().replace(/ё/g, 'е');
  const parts = s.split(/(\s+|-)/);
  if (!parts.length) return s;
  // последнее «слово» (не разделитель)
  for (let i = parts.length - 1; i >= 0; i--) {
    const w = parts[i]!;
    if (!w || /^[\s-]+$/.test(w)) continue;
    // …у → …а (Усть-Коксу / коксу)
    if (/^[А-Яа-яA-Za-z]{3,}у$/iu.test(w)) {
      parts[i] = `${w.slice(0, -1)}а`;
    }
    break;
  }
  return parts.join('');
}

function locationVariants(raw: string): string[] {
  const base = stripWeatherNoise(raw);
  const soft = softenRussianPlace(base);
  const variants = [
    base,
    soft,
    base.replace(/\s+/g, '-'),
    soft.replace(/\s+/g, '-'),
    base.replace(/-/g, ' '),
    soft.replace(/-/g, ' '),
    // добавим регион, если похоже на алтайские «усть-»
    /усть/i.test(base) && !/алтай/i.test(base) ? `${soft} Алтай` : '',
    /усть/i.test(base) && !/алтай/i.test(base) ? `${soft.replace(/\s+/g, '-')} Республика Алтай` : '',
  ]
    .map((v) => v.trim().replace(/\s+/g, ' '))
    .filter(Boolean);

  return [...new Set(variants)].slice(0, 8);
}

function aliasLookup(q: string): GeoHit | null {
  const key = stripWeatherNoise(q)
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/\s+/g, ' ')
    .trim();
  const soft = softenRussianPlace(key).toLowerCase().replace(/\s+/g, ' ');
  const hit =
    PLACE_ALIASES[key] ||
    PLACE_ALIASES[soft] ||
    PLACE_ALIASES[key.replace(/\s+/g, '-')] ||
    PLACE_ALIASES[soft.replace(/\s+/g, '-')] ||
    PLACE_ALIASES[key.replace(/-/g, ' ')] ||
    PLACE_ALIASES[soft.replace(/-/g, ' ')];
  if (!hit) return null;
  return { ...hit };
}

function scoreHit(hit: GeoHit, query: string): number {
  const q = query.toLowerCase().replace(/ё/g, 'е').replace(/-/g, ' ').trim();
  const name = (hit.name || '').toLowerCase().replace(/ё/g, 'е').replace(/-/g, ' ');
  const admin = `${hit.admin1 || ''} ${hit.country || ''}`.toLowerCase();
  let score = 0;
  if (name === q) score += 160;
  else if (name.startsWith(q) || q.startsWith(name)) score += 90;
  else if (name.includes(q) || q.includes(name)) score += 45;
  const qTokens = q.split(/\s+/).filter((t) => t.length > 2);
  const nameTokens = name.split(/\s+/);
  for (const t of qTokens) {
    if (nameTokens.some((n) => n === t)) score += 22;
    else if (nameTokens.some((n) => n.startsWith(t) || t.startsWith(n))) score += 10;
  }
  const isRu =
    hit.country_code === 'RU' || /россия|russia/i.test(hit.country || '');
  if (isRu) score += 35;
  if (/алтай/i.test(admin) && /усть|алтай|кой|кокс/i.test(q)) score += 50;
  // население — только тай-брейкер, не перебивает точное имя
  if (typeof hit.population === 'number') {
    score += Math.min(12, Math.log10(hit.population + 10));
  }
  if (/[а-яё]/i.test(q) && hit.country_code && hit.country_code !== 'RU') score -= 55;
  // штраф за «чужое» короткое совпадение (напр. деревня vs город с другим именем)
  if (name !== q && q.length >= 4 && !name.includes(q) && !q.includes(name)) {
    score -= 20;
  }
  return score;
}

async function geocodeOpenMeteo(
  name: string,
  opts?: { countryCode?: string },
): Promise<GeoHit[]> {
  const params: Record<string, string> = {
    name,
    count: '12',
    language: 'ru',
    format: 'json',
  };
  if (opts?.countryCode) params.countryCode = opts.countryCode;
  const data = await fetchJson<{ results?: GeoHit[] }>(
    `${GEO_URL}?${new URLSearchParams(params)}`,
  );
  return data.results || [];
}

async function geocodeNominatim(name: string): Promise<GeoHit[]> {
  const url = `${NOMINATIM_URL}?${new URLSearchParams({
    q: name,
    format: 'jsonv2',
    addressdetails: '1',
    limit: '5',
    'accept-language': 'ru',
  })}`;
  try {
    const data = await fetchJson<
      {
        display_name?: string;
        name?: string;
        lat?: string;
        lon?: string;
        address?: {
          city?: string;
          town?: string;
          village?: string;
          municipality?: string;
          state?: string;
          country?: string;
          country_code?: string;
        };
      }[]
    >(url, 6_000, {
      'User-Agent': 'XelityWeather/1.0 (https://xelity.ru)',
    });
    return (data || [])
      .map((row) => {
        const addr = row.address || {};
        const place =
          row.name ||
          addr.village ||
          addr.town ||
          addr.city ||
          addr.municipality ||
          (row.display_name || '').split(',')[0] ||
          name;
        const lat = Number(row.lat);
        const lon = Number(row.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        return {
          name: place.trim(),
          admin1: addr.state,
          country: addr.country,
          country_code: (addr.country_code || '').toUpperCase(),
          latitude: lat,
          longitude: lon,
        } as GeoHit;
      })
      .filter(Boolean) as GeoHit[];
  } catch {
    return [];
  }
}

async function geocode(location: string): Promise<GeoHit | null> {
  const raw = location.trim().slice(0, 120);
  if (!raw) return null;

  const alias = aliasLookup(raw);
  if (alias) return alias;

  const variants = locationVariants(raw);
  let best: GeoHit | null = null;
  let bestScore = -Infinity;

  const preferRu = /[а-яё]/i.test(raw);

  for (const v of variants) {
    const aliasV = aliasLookup(v);
    if (aliasV) return aliasV;

    const passCountry: (string | undefined)[] = preferRu
      ? ['RU', undefined]
      : [undefined];

    for (const countryCode of passCountry) {
      let hits: GeoHit[] = [];
      try {
        hits = await geocodeOpenMeteo(v, { countryCode });
      } catch {
        hits = [];
      }
      for (const h of hits) {
        const s = scoreHit(h, v);
        if (s > bestScore) {
          bestScore = s;
          best = h;
        }
      }
      // точное RU-совпадение — достаточно
      if (best && bestScore >= 140) break;
    }
    if (best && bestScore >= 140) break;
  }

  if (best && bestScore >= 40) return best;

  // Nominatim fallback для мелких посёлков РФ
  for (const v of variants.slice(0, 4)) {
    const hits = await geocodeNominatim(v);
    for (const h of hits) {
      const s = scoreHit(h, v) + 5; // небольшой бонус за то, что OM не нашёл
      if (s > bestScore) {
        bestScore = s;
        best = h;
      }
    }
    if (best && bestScore >= 60) break;
  }

  return bestScore >= 30 ? best : null;
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

    const loc = (args.location || '').trim();

    // Если передали и location, и координаты — приоритет у geocode(location),
    // иначе модель может «залипнуть» на старых координатах (напр. Барнаул).
    if (loc) {
      const geo = await geocode(loc);
      if (!geo) {
        return {
          ok: false,
          forModel: `get_weather: место «${loc}» не найдено. Уточни населённый пункт (например: Усть-Кокса, Республика Алтай).`,
          error: 'Место не найдено',
        };
      }
      lat = geo.latitude;
      lon = geo.longitude;
      place = geo.name;
      country = geo.country;
      admin1 = geo.admin1;
      tzHint = geo.timezone;
    } else if (Number.isFinite(lat) && Number.isFinite(lon)) {
      place = `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
    } else {
      return {
        ok: false,
        forModel: 'get_weather: укажи location (город) или latitude+longitude',
        error: 'Нужен город или координаты',
      };
    }

    const days = Math.min(7, Math.max(1, Math.floor(args.days ?? 7)));
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      timezone: 'auto',
      temperature_unit: 'celsius',
      wind_speed_unit: 'kmh',
      forecast_days: String(days),
      // best_match ближе к «народной» погоде (как в агрегаторах)
      models: 'best_match',
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
    });

    let fc: ForecastResp;
    try {
      fc = await fetchJson<ForecastResp>(`${FORECAST_URL}?${params}`);
    } catch {
      // некоторые зеркала не принимают models=best_match
      params.delete('models');
      fc = await fetchJson<ForecastResp>(`${FORECAST_URL}?${params}`);
    }
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
    const today = weather.daily[0];
    const forModel = [
      `WEATHER (Open-Meteo) for ${where}`,
      `Coords: ${lat.toFixed(4)}, ${lon.toFixed(4)} · TZ: ${weather.timezone}`,
      `Updated: ${weather.updatedAt}`,
      `Now (current): ${weather.current.tempC}°C (feels ${weather.current.feelsLikeC}°C), ${weather.current.label}, humidity ${weather.current.humidity}%, wind ${weather.current.windKmh} km/h, precip ${weather.current.precipMm} mm`,
      today
        ? `Today range: ${today.tempMinC}…${today.tempMaxC}°C (Google/Yandex often show daytime high ≈ ${today.tempMaxC}°C, not "now")`
        : '',
      'Daily:',
      ...weather.daily.map(
        (d) =>
          `- ${d.date}: ${d.tempMinC}…${d.tempMaxC}°C, ${d.label}, precip ${d.precipMm} mm`,
      ),
      '',
      'UI already shows an interactive weather card from this tool result.',
      'In your reply: say BOTH current temp and today high/low. Do not invent other temperatures.',
      'Note: timezone Asia/Barnaul is Altai region TZ — NOT the city Barnaul.',
    ]
      .filter(Boolean)
      .join('\n');

    return {
      ok: true,
      forModel,
      summary: today
        ? `${where}: сейчас ${weather.current.tempC}°C, сегодня до ${today.tempMaxC}°C`
        : `${where}: ${weather.current.tempC}°C`,
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
