/** Запрос похож на просьбу о погоде / прогнозе / температуре */
export function looksLikeWeatherQuery(text: string): boolean {
  const t = (text || '').trim().toLowerCase().replace(/ё/g, 'е');
  if (!t) return false;
  return (
    /\b(погод\w*|прогноз\w*|температур\w*|градус\w*|осадк\w*|дожд\w*|снег\w*|ветер\w*|влажност\w*|weather|forecast|temperature|rain|snow)\b/i.test(
      t,
    ) ||
    /какая\s+(сейчас\s+)?погода/i.test(t) ||
    /сколько\s+градус/i.test(t)
  );
}
