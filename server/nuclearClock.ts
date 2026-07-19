/**
 * «Ядерный таймер» — актуальные часы/дата в каждый system prompt,
 * чтобы модель всегда знала текущий момент времени.
 */

function pad(n: number, len = 2) {
  return String(n).padStart(len, '0');
}

function formatInZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    weekday: 'long',
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value || '';

  const y = get('year');
  const m = get('month');
  const d = get('day');
  const h = get('hour');
  const min = get('minute');
  const s = get('second');
  const weekday = get('weekday');

  return {
    isoLocal: `${y}-${m}-${d}T${h}:${min}:${s}`,
    human: `${weekday}, ${y}-${m}-${d} ${h}:${min}:${s}`,
    date: `${y}-${m}-${d}`,
    time: `${h}:${min}:${s}`,
  };
}

function dayOfYear(date: Date, timeZone: string): number {
  const { date: ymd } = formatInZone(date, timeZone);
  const [y, m, d] = ymd.split('-').map(Number);
  const start = Date.UTC(y!, 0, 0);
  const now = Date.UTC(y!, m! - 1, d!);
  return Math.floor((now - start) / 86_400_000);
}

/** Блок для system prompt — вызывать на КАЖДЫЙ запрос (свежие секунды). */
export function buildNuclearClockBlock(now = new Date()): string {
  const utc = formatInZone(now, 'UTC');
  const moscow = formatInZone(now, 'Europe/Moscow');
  const utcOffsetMin = -now.getTimezoneOffset();
  const sign = utcOffsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(utcOffsetMin);
  const serverOffset = `UTC${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;

  const isoUtc = now.toISOString();
  const unix = Math.floor(now.getTime() / 1000);
  const ms = now.getTime();
  const week = Math.ceil(dayOfYear(now, 'UTC') / 7);

  return `☢ ЯДЕРНЫЙ ТАЙМЕР (истина времени для этого запроса — не выдумывай дату/час):
- Unix: ${unix} (ms: ${ms})
- UTC ISO: ${isoUtc}
- UTC: ${utc.human}
- Москва (Europe/Moscow): ${moscow.human}
- Часовой пояс сервера: ${serverOffset}
- День года (UTC): ${dayOfYear(now, 'UTC')} · неделя ≈ ${week}
- Используй эти метки для «сегодня / сейчас / этой недели». Температуру и погоду не угадывай — только из результата tool, если он доступен.`;
}
