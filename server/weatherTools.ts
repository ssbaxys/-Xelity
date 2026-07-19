/**
 * Погода: WeatherAPI.com (основной) + Open-Meteo (fallback).
 * Ключ: WEATHERAPI_KEY в .env (https://www.weatherapi.com/ — free tier).
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
  source: string;
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

type PlaceAlias = {
  name: string;
  admin1?: string;
  country?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
};

const PLACE_ALIASES: Record<string, PlaceAlias> = {
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
  баранул: {
    name: 'Барнаул',
    admin1: 'Алтайский край',
    country: 'Россия',
    latitude: 53.3606,
    longitude: 83.7636,
    timezone: 'Asia/Barnaul',
  },
  барналу: {
    name: 'Барнаул',
    admin1: 'Алтайский край',
    country: 'Россия',
    latitude: 53.3606,
    longitude: 83.7636,
    timezone: 'Asia/Barnaul',
  },
  барнаула: {
    name: 'Барнаул',
    admin1: 'Алтайский край',
    country: 'Россия',
    latitude: 53.3606,
    longitude: 83.7636,
    timezone: 'Asia/Barnaul',
  },
};

const FUZZY_CITIES: { keys: string[]; place: PlaceAlias }[] = [
  { keys: ['барнаул', 'barnaul'], place: PLACE_ALIASES['барнаул']! },
  { keys: ['москва', 'moscow'], place: PLACE_ALIASES['москва']! },
  { keys: ['новосибирск', 'novosibirsk'], place: PLACE_ALIASES['новосибирск']! },
  {
    keys: ['санкт петербург', 'петербург', 'питер', 'spb'],
    place: PLACE_ALIASES['петербург']!,
  },
  {
    keys: ['екатеринбург', 'екб', 'yekaterinburg'],
    place: {
      name: 'Екатеринбург',
      admin1: 'Свердловская область',
      country: 'Россия',
      latitude: 56.8389,
      longitude: 60.6057,
      timezone: 'Asia/Yekaterinburg',
    },
  },
  {
    keys: ['красноярск', 'krasnoyarsk'],
    place: {
      name: 'Красноярск',
      admin1: 'Красноярский край',
      country: 'Россия',
      latitude: 56.0153,
      longitude: 92.8932,
      timezone: 'Asia/Krasnoyarsk',
    },
  },
  {
    keys: ['томск', 'tomsk'],
    place: {
      name: 'Томск',
      admin1: 'Томская область',
      country: 'Россия',
      latitude: 56.4846,
      longitude: 84.9476,
      timezone: 'Asia/Tomsk',
    },
  },
  {
    keys: ['кемерово', 'kemerovo'],
    place: {
      name: 'Кемерово',
      admin1: 'Кемеровская область',
      country: 'Россия',
      latitude: 55.3549,
      longitude: 86.0873,
      timezone: 'Asia/Novokuznetsk',
    },
  },
  {
    keys: ['новокузнецк', 'novokuznetsk'],
    place: {
      name: 'Новокузнецк',
      admin1: 'Кемеровская область',
      country: 'Россия',
      latitude: 53.7596,
      longitude: 87.1216,
      timezone: 'Asia/Novokuznetsk',
    },
  },
  {
    keys: ['горно алтайск', 'горноалтайск'],
    place: PLACE_ALIASES['горно-алтайск']!,
  },
  { keys: ['усть кокса', 'устькокса'], place: PLACE_ALIASES['усть-кокса']! },
];

/** WeatherAPI condition.code → WMO-подобный код для иконок карточки */
function weatherApiToWmo(code: number): number {
  const map: Record<number, number> = {
    1000: 0,
    1003: 2,
    1006: 3,
    1009: 3,
    1030: 45,
    1063: 61,
    1066: 71,
    1069: 66,
    1072: 56,
    1087: 95,
    1114: 71,
    1117: 75,
    1135: 45,
    1147: 48,
    1150: 51,
    1153: 51,
    1168: 56,
    1171: 57,
    1180: 61,
    1183: 61,
    1186: 63,
    1189: 63,
    1192: 65,
    1195: 65,
    1198: 66,
    1201: 67,
    1204: 66,
    1207: 67,
    1210: 71,
    1213: 71,
    1216: 73,
    1219: 73,
    1222: 75,
    1225: 75,
    1237: 75,
    1240: 80,
    1243: 81,
    1246: 82,
    1249: 80,
    1252: 82,
    1255: 85,
    1258: 86,
    1261: 85,
    1264: 86,
    1273: 95,
    1276: 96,
    1279: 95,
    1282: 96,
  };
  return map[code] ?? 2;
}

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

async function fetchJson<T>(
  url: string,
  timeoutMs = 12_000,
  extraHeaders?: Record<string, string>,
): Promise<T> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json', ...extraHeaders },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}${body ? `: ${body.slice(0, 120)}` : ''}`);
    }
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
    /усть/i.test(base) && !/алтай/i.test(base) ? `${soft} Алтай` : '',
  ]
    .map((v) => v.trim().replace(/\s+/g, ' '))
    .filter(Boolean);
  return [...new Set(variants)].slice(0, 8);
}

function scoreHit(hit: GeoHit, query: string): number {
  const q = query.toLowerCase().replace(/ё/g, 'е').replace(/-/g, ' ').trim();
  const name = (hit.name || '').toLowerCase().replace(/ё/g, 'е').replace(/-/g, ' ');
  const admin = `${hit.admin1 || ''} ${hit.country || ''}`.toLowerCase();
  let score = 0;
  if (name === q) score += 160;
  else if (name.startsWith(q) || q.startsWith(name)) score += 90;
  else if (name.includes(q) || q.includes(name)) score += 45;
  const isRu =
    hit.country_code === 'RU' || /россия|russia/i.test(hit.country || '');
  if (isRu) score += 35;
  if (/алтай/i.test(admin) && /усть|алтай|кой|кокс/i.test(q)) score += 50;
  if (typeof hit.population === 'number') {
    score += Math.min(12, Math.log10(hit.population + 10));
  }
  if (/[а-яё]/i.test(q) && hit.country_code && hit.country_code !== 'RU') score -= 55;
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
    `https://geocoding-api.open-meteo.com/v1/search?${new URLSearchParams(params)}`,
  );
  return data.results || [];
}

async function geocodeNominatim(name: string): Promise<GeoHit[]> {
  const url = `https://nominatim.openstreetmap.org/search?${new URLSearchParams({
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
    >(url, 6_000, { 'User-Agent': 'XelityWeather/1.0 (https://xelity.ru)' });
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

/** Геокодинг для fallback Open-Meteo (алиас → OM → Nominatim) */
async function geocode(location: string): Promise<GeoHit | null> {
  const raw = location.trim().slice(0, 120);
  if (!raw) return null;

  const alias = aliasLookup(raw);
  if (alias) {
    return {
      name: alias.name,
      country: alias.country,
      admin1: alias.admin1,
      latitude: alias.latitude,
      longitude: alias.longitude,
      timezone: alias.timezone,
      country_code: 'RU',
    };
  }

  const variants = locationVariants(raw);
  let best: GeoHit | null = null;
  let bestScore = -Infinity;
  const preferRu = /[а-яё]/i.test(raw);

  for (const v of variants) {
    const aliasV = aliasLookup(v);
    if (aliasV) {
      return {
        name: aliasV.name,
        country: aliasV.country,
        admin1: aliasV.admin1,
        latitude: aliasV.latitude,
        longitude: aliasV.longitude,
        timezone: aliasV.timezone,
        country_code: 'RU',
      };
    }
    for (const countryCode of preferRu ? ['RU', undefined] : [undefined]) {
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
      if (best && bestScore >= 140) break;
    }
    if (best && bestScore >= 140) break;
  }

  if (best && bestScore >= 40) return best;

  for (const v of variants.slice(0, 4)) {
    const hits = await geocodeNominatim(v);
    for (const h of hits) {
      const s = scoreHit(h, v) + 5;
      if (s > bestScore) {
        bestScore = s;
        best = h;
      }
    }
    if (best && bestScore >= 60) break;
  }

  return bestScore >= 30 ? best : null;
}

function stripWeatherNoise(q: string): string {
  return q
    .replace(/^(какая|какой|какое|скажи|покажи|дай|узнай|проверь)\s+/giu, '')
    .replace(
      /^(погода|прогноз|weather|forecast|температура)\s+(в|во|на|для|у|около)?\s*/giu,
      '',
    )
    .replace(/\s+(погода|прогноз|weather|сейчас|сегодня|завтра)$/giu, '')
    .replace(/^(в|во|на|для|у|около|про)\s+/giu, '')
    .replace(/^(лего|дляо|для)\s+/giu, '')
    .trim();
}

function softenRussianPlace(q: string): string {
  const s = q.trim().replace(/ё/g, 'е');
  const parts = s.split(/(\s+|-)/);
  if (!parts.length) return s;
  for (let i = parts.length - 1; i >= 0; i--) {
    const w = parts[i]!;
    if (!w || /^[\s-]+$/.test(w)) continue;
    if (/^[А-Яа-яA-Za-z]{3,}у$/iu.test(w)) {
      parts[i] = `${w.slice(0, -1)}а`;
    }
    break;
  }
  return parts.join('');
}

function placeKey(q: string): string {
  return stripWeatherNoise(q)
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function editDistance(a: string, b: string): number {
  const n = a.length;
  const m = b.length;
  if (n === 0) return m;
  if (m === 0) return n;
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    Array.from({ length: m + 1 }, () => 0),
  );
  for (let i = 0; i <= n; i++) dp[i]![0] = i;
  for (let j = 0; j <= m; j++) dp[0]![j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,
        dp[i]![j - 1]! + 1,
        dp[i - 1]![j - 1]! + cost,
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i]![j] = Math.min(dp[i]![j]!, dp[i - 2]![j - 2]! + 1);
      }
    }
  }
  return dp[n]![m]!;
}

function maxTypoDistance(len: number): number {
  if (len <= 4) return 1;
  if (len <= 8) return 2;
  return 3;
}

function aliasLookup(q: string): PlaceAlias | null {
  const key = placeKey(q);
  const soft = placeKey(softenRussianPlace(key));
  const hit =
    PLACE_ALIASES[key] ||
    PLACE_ALIASES[soft] ||
    PLACE_ALIASES[key.replace(/\s+/g, '-')] ||
    PLACE_ALIASES[soft.replace(/\s+/g, '-')] ||
    PLACE_ALIASES[q.toLowerCase().trim()];
  if (hit) return { ...hit };

  const candidates = new Map<string, PlaceAlias>();
  for (const [k, p] of Object.entries(PLACE_ALIASES)) {
    candidates.set(placeKey(k), p);
    candidates.set(placeKey(p.name), p);
  }
  for (const row of FUZZY_CITIES) {
    for (const k of row.keys) candidates.set(placeKey(k), row.place);
    candidates.set(placeKey(row.place.name), row.place);
  }

  let best: PlaceAlias | null = null;
  let bestDist = Infinity;
  const qLen = Math.max(key.length, soft.length);
  const limit = maxTypoDistance(qLen);

  for (const [cand, place] of candidates) {
    for (const qv of [key, soft]) {
      if (!qv || qv.length < 3) continue;
      if (Math.abs(qv.length - cand.length) > limit) continue;
      const d = editDistance(qv, cand);
      if (d > 0 && d <= limit && d < bestDist) {
        bestDist = d;
        best = place;
      }
    }
  }
  return best && bestDist <= limit ? { ...best } : null;
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function weatherApiKey(): string {
  return (process.env.WEATHERAPI_KEY || process.env.WEATHER_API_KEY || '').trim();
}

/** "05:30 AM" + date → ISO-like for WeatherCard */
function astroToIso(date: string, ampm: string | undefined): string | undefined {
  if (!ampm) return undefined;
  const m = ampm.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!m) return undefined;
  let h = Number(m[1]);
  const min = m[2];
  const ap = (m[3] || '').toUpperCase();
  if (ap === 'PM' && h < 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return `${date}T${String(h).padStart(2, '0')}:${min}:00`;
}

function buildResult(weather: WeatherPayload): WeatherToolResult {
  const where = [weather.place, weather.admin1, weather.country].filter(Boolean).join(', ');
  const today = weather.daily[0];
  const forModel = [
    `WEATHER for ${where}`,
    `Coords: ${weather.latitude.toFixed(4)}, ${weather.longitude.toFixed(4)} · TZ: ${weather.timezone}`,
    `Updated: ${weather.updatedAt}`,
    `Now (current): ${weather.current.tempC}°C (feels ${weather.current.feelsLikeC}°C), ${weather.current.label}, humidity ${weather.current.humidity}%, wind ${weather.current.windKmh} km/h, precip ${weather.current.precipMm} mm`,
    today
      ? `Today range: ${today.tempMinC}…${today.tempMaxC}°C (daytime high ≈ ${today.tempMaxC}°C)`
      : '',
    'Daily:',
    ...weather.daily.map(
      (d) =>
        `- ${d.date}: ${d.tempMinC}…${d.tempMaxC}°C, ${d.label}, precip ${d.precipMm} mm`,
    ),
    '',
    'UI shows a weather card. Reply with current temp AND today high/low. Do not invent other temperatures.',
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
}

type WaForecast = {
  location?: {
    name?: string;
    region?: string;
    country?: string;
    lat?: number;
    lon?: number;
    tz_id?: string;
    localtime?: string;
  };
  current?: {
    temp_c?: number;
    feelslike_c?: number;
    humidity?: number;
    wind_kph?: number;
    wind_degree?: number;
    precip_mm?: number;
    is_day?: number;
    last_updated?: string;
    condition?: { text?: string; code?: number };
  };
  forecast?: {
    forecastday?: {
      date?: string;
      day?: {
        maxtemp_c?: number;
        mintemp_c?: number;
        totalprecip_mm?: number;
        condition?: { text?: string; code?: number };
      };
      astro?: { sunrise?: string; sunset?: string };
    }[];
  };
  error?: { message?: string; code?: number };
};

async function fetchWeatherApi(
  q: string,
  days: number,
): Promise<WeatherPayload> {
  const key = weatherApiKey();
  if (!key) throw new Error('WEATHERAPI_KEY не задан');

  // free: до 3 дней; если ключ платный — до 7
  const want = Math.min(7, Math.max(1, days));
  const tryDays = want > 3 ? [want, 3] : [want];

  let lastErr: Error | null = null;
  for (const d of tryDays) {
    try {
      const url = `https://api.weatherapi.com/v1/forecast.json?${new URLSearchParams({
        key,
        q,
        days: String(d),
        aqi: 'no',
        alerts: 'no',
        lang: 'ru',
      })}`;
      const data = await fetchJson<WaForecast>(url);
      if (data.error?.message) throw new Error(data.error.message);
      const loc = data.location;
      const cur = data.current;
      if (!loc || !cur || cur.temp_c == null) throw new Error('пустой ответ WeatherAPI');

      const code = weatherApiToWmo(Number(cur.condition?.code ?? 1000));
      const label = (cur.condition?.text || '').trim() || wmoLabel(code);

      return {
        place: loc.name || q,
        country: loc.country,
        admin1: loc.region,
        latitude: Number(loc.lat),
        longitude: Number(loc.lon),
        timezone: loc.tz_id || 'auto',
        updatedAt: cur.last_updated || loc.localtime || new Date().toISOString(),
        source: 'Xelity Weather',
        current: {
          tempC: round1(cur.temp_c),
          feelsLikeC: round1(cur.feelslike_c ?? cur.temp_c),
          humidity: Math.round(cur.humidity ?? 0),
          windKmh: round1(cur.wind_kph ?? 0),
          windDir: Math.round(cur.wind_degree ?? 0),
          precipMm: round1(cur.precip_mm ?? 0),
          code,
          label,
          isDay: cur.is_day !== 0,
        },
        daily: (data.forecast?.forecastday || []).map((fd) => {
          const dCode = weatherApiToWmo(Number(fd.day?.condition?.code ?? 1000));
          const dLabel =
            (fd.day?.condition?.text || '').trim() || wmoLabel(dCode);
          const date = fd.date || '';
          return {
            date,
            code: dCode,
            label: dLabel,
            tempMaxC: round1(fd.day?.maxtemp_c ?? 0),
            tempMinC: round1(fd.day?.mintemp_c ?? 0),
            precipMm: round1(fd.day?.totalprecip_mm ?? 0),
            sunrise: astroToIso(date, fd.astro?.sunrise),
            sunset: astroToIso(date, fd.astro?.sunset),
          };
        }),
      };
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e));
    }
  }
  throw lastErr || new Error('WeatherAPI failed');
}

/** Fallback Open-Meteo по координатам */
async function fetchOpenMeteo(
  lat: number,
  lon: number,
  days: number,
  meta: { place: string; country?: string; admin1?: string; timezone?: string },
): Promise<WeatherPayload> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    timezone: 'auto',
    temperature_unit: 'celsius',
    wind_speed_unit: 'kmh',
    forecast_days: String(Math.min(7, Math.max(1, days))),
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
  const fc = await fetchJson<{
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
  }>(`https://api.open-meteo.com/v1/forecast?${params}`);

  const cur = fc.current;
  if (!cur || cur.temperature_2m == null || cur.weather_code == null) {
    throw new Error('пустой Open-Meteo');
  }
  const code = Number(cur.weather_code);
  return {
    place: meta.place,
    country: meta.country,
    admin1: meta.admin1,
    latitude: lat,
    longitude: lon,
    timezone: fc.timezone || meta.timezone || 'auto',
    updatedAt: cur.time || new Date().toISOString(),
    source: 'Xelity Weather',
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
}

export async function executeGetWeather(args: {
  location?: string;
  latitude?: number;
  longitude?: number;
  days?: number;
}): Promise<WeatherToolResult> {
  try {
    const days = Math.min(7, Math.max(1, Math.floor(args.days ?? 7)));
    let lat = typeof args.latitude === 'number' ? args.latitude : NaN;
    let lon = typeof args.longitude === 'number' ? args.longitude : NaN;
    const locRaw = (args.location || '').trim();
    const loc = stripWeatherNoise(locRaw) || locRaw;

    let queryForApi = '';
    let hintPlace = '';
    let hintCountry: string | undefined;
    let hintAdmin: string | undefined;
    let hintTz: string | undefined;

    if (loc) {
      const alias = aliasLookup(loc);
      if (alias) {
        queryForApi = `${alias.latitude},${alias.longitude}`;
        hintPlace = alias.name;
        hintCountry = alias.country;
        hintAdmin = alias.admin1;
        hintTz = alias.timezone;
        lat = alias.latitude;
        lon = alias.longitude;
      } else {
        queryForApi = loc;
        hintPlace = loc;
      }
    } else if (Number.isFinite(lat) && Number.isFinite(lon)) {
      queryForApi = `${lat},${lon}`;
      hintPlace = `${lat.toFixed(2)}, ${lon.toFixed(2)}`;
    } else {
      return {
        ok: false,
        forModel: 'get_weather: укажи location (город) или latitude+longitude',
        error: 'Нужен город или координаты',
      };
    }

    // 1) WeatherAPI (основной) — сам умеет искать город по имени
    if (weatherApiKey()) {
      try {
        const weather = await fetchWeatherApi(queryForApi, days);
        if (hintPlace && !/^\d/.test(hintPlace)) {
          weather.place = hintPlace;
          if (hintAdmin) weather.admin1 = hintAdmin;
          if (hintCountry) weather.country = hintCountry;
        }
        return buildResult(weather);
      } catch {
        // fallback ниже
      }
    }

    // 2) Геокодинг, если координат ещё нет
    if ((!Number.isFinite(lat) || !Number.isFinite(lon)) && loc) {
      const geo = await geocode(loc);
      if (geo) {
        lat = geo.latitude;
        lon = geo.longitude;
        hintPlace = geo.name || hintPlace;
        hintCountry = geo.country || hintCountry;
        hintAdmin = geo.admin1 || hintAdmin;
        hintTz = geo.timezone || hintTz;
      }
    }

    // 3) Open-Meteo fallback по координатам
    if (Number.isFinite(lat) && Number.isFinite(lon)) {
      try {
        const weather = await fetchOpenMeteo(lat, lon, days, {
          place: hintPlace || `${lat.toFixed(2)}, ${lon.toFixed(2)}`,
          country: hintCountry,
          admin1: hintAdmin,
          timezone: hintTz,
        });
        return buildResult(weather);
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'ошибка';
        return {
          ok: false,
          forModel: `get_weather failed: ${msg}`,
          error: msg,
        };
      }
    }

    const hint = loc ? aliasLookup(loc) : null;
    return {
      ok: false,
      forModel: `get_weather: место «${loc || queryForApi}» не найдено.${
        hint
          ? ` Похоже на «${hint.name}» — вызови get_weather с location="${hint.name}".`
          : ' Уточни город или регион (или задай WEATHERAPI_KEY в .env).'
      }`,
      error: 'Место не найдено',
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
