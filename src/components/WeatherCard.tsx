import { useId, useState } from 'react';
import {
  dayMonthRu,
  formatWeatherPlace,
  weatherIconKind,
  weekdayShortRu,
  type WeatherPayload,
} from '../lib/weather';
import WeatherIcon from './WeatherIcons';

type Props = {
  weather?: WeatherPayload | null;
  pending?: boolean;
  /** Пока грузится — подпись места из args */
  pendingPlace?: string;
};

function windArrow(deg: number) {
  return { transform: `rotate(${deg}deg)` };
}

function toneFromTemp(t: number) {
  if (t >= 28) return 'hot';
  if (t >= 18) return 'warm';
  if (t >= 5) return 'mild';
  if (t >= -5) return 'cool';
  return 'cold';
}

export default function WeatherCard({ weather, pending, pendingPlace }: Props) {
  const uid = useId().replace(/:/g, '');
  const [selected, setSelected] = useState(0);
  const showPending = Boolean(pending) || !weather;

  if (showPending || !weather) {
    return (
      <div className="weather-card weather-card--mild is-pending" data-weather={uid}>
        <div className="weather-card-glow" aria-hidden />
        <header className="weather-card-head">
          <div className="min-w-0">
            <p className="weather-card-place truncate">
              {pendingPlace?.trim() || 'Погода'}
            </p>
            <p className="weather-card-meta">Загрузка погоды…</p>
          </div>
          <WeatherIcon kind="partly" isDay className="weather-card-hero-icon tool-icon-spin" />
        </header>
        <div className="weather-card-now">
          <div className="weather-card-temp">
            <span className="weather-card-temp-num weather-card-temp-skeleton">··</span>
            <span className="weather-card-temp-unit">°C</span>
          </div>
          <div className="weather-card-now-info">
            <p className="weather-card-label">Получаю данные</p>
            <p className="weather-card-feels">Карточка появится через мгновение</p>
          </div>
        </div>
      </div>
    );
  }

  const place = formatWeatherPlace(weather);
  const days = weather.daily.slice(0, 7);
  const focus = days[selected] ?? null;
  const showCurrent = selected === 0;

  const heroCode = showCurrent ? weather.current.code : (focus?.code ?? weather.current.code);
  const heroKind = weatherIconKind(heroCode);
  const heroLabel = showCurrent
    ? weather.current.label
    : (focus?.label ?? weather.current.label);
  const heroTemp = showCurrent
    ? weather.current.tempC
    : focus
      ? (focus.tempMaxC + focus.tempMinC) / 2
      : weather.current.tempC;
  const tone = toneFromTemp(heroTemp);

  const todayMax = days[0]?.tempMaxC;
  const todayMin = days[0]?.tempMinC;

  return (
    <div className={`weather-card weather-card--${tone}`} data-weather={uid}>
      <div className="weather-card-glow" aria-hidden />
      <header className="weather-card-head">
        <div className="min-w-0">
          <p className="weather-card-place truncate">{place}</p>
          <p className="weather-card-meta">
            {weather.latitude.toFixed(2)}°, {weather.longitude.toFixed(2)}° ·{' '}
            {weather.source}
          </p>
        </div>
        <WeatherIcon
          kind={heroKind}
          isDay={showCurrent ? weather.current.isDay : true}
          className="weather-card-hero-icon"
        />
      </header>

      <div className="weather-card-now">
        <div className="weather-card-temp">
          <span className="weather-card-temp-num">{Math.round(heroTemp)}</span>
          <span className="weather-card-temp-unit">°C</span>
        </div>
        <div className="weather-card-now-info">
          <p className="weather-card-label">{heroLabel}</p>
          <p className="weather-card-feels">
            {showCurrent ? (
              <>
                Ощущается как {Math.round(weather.current.feelsLikeC)}°
                {typeof todayMax === 'number' && typeof todayMin === 'number'
                  ? ` · сегодня ${Math.round(todayMin)}…${Math.round(todayMax)}°`
                  : ''}
              </>
            ) : focus ? (
              <>
                {dayMonthRu(focus.date)} · {Math.round(focus.tempMinC)}…
                {Math.round(focus.tempMaxC)}°
              </>
            ) : null}
          </p>
        </div>
      </div>

      {showCurrent ? (
        <div className="weather-card-stats">
          <div className="weather-stat">
            <span className="weather-stat-k">Влажность</span>
            <span className="weather-stat-v">{weather.current.humidity}%</span>
          </div>
          <div className="weather-stat">
            <span className="weather-stat-k">Ветер</span>
            <span className="weather-stat-v inline-flex items-center gap-1">
              <span
                className="weather-wind-arrow"
                style={windArrow(weather.current.windDir)}
                aria-hidden
              >
                ↑
              </span>
              {Math.round(weather.current.windKmh)} км/ч
            </span>
          </div>
          <div className="weather-stat">
            <span className="weather-stat-k">Осадки</span>
            <span className="weather-stat-v">{weather.current.precipMm} мм</span>
          </div>
        </div>
      ) : focus ? (
        <div className="weather-card-stats">
          <div className="weather-stat">
            <span className="weather-stat-k">Макс</span>
            <span className="weather-stat-v">{Math.round(focus.tempMaxC)}°</span>
          </div>
          <div className="weather-stat">
            <span className="weather-stat-k">Мин</span>
            <span className="weather-stat-v">{Math.round(focus.tempMinC)}°</span>
          </div>
          <div className="weather-stat">
            <span className="weather-stat-k">Осадки</span>
            <span className="weather-stat-v">{focus.precipMm} мм</span>
          </div>
        </div>
      ) : null}

      {days.length > 0 && (
        <div className="weather-card-days" role="listbox" aria-label="Прогноз">
          {days.map((d, i) => {
            const active = i === selected;
            return (
              <button
                key={d.date}
                type="button"
                role="option"
                aria-selected={active}
                className={`weather-day ${active ? 'is-active' : ''}`}
                onClick={() => setSelected(i)}
              >
                <span className="weather-day-wd">{weekdayShortRu(d.date)}</span>
                <WeatherIcon
                  kind={weatherIconKind(d.code)}
                  className="weather-day-icon"
                  isDay
                />
                <span className="weather-day-t">
                  <b>{Math.round(d.tempMaxC)}°</b>
                  <span>{Math.round(d.tempMinC)}°</span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {focus && (
        <footer className="weather-card-foot">
          <p>
            <strong>{dayMonthRu(focus.date)}</strong> — {focus.label}
          </p>
          <p>
            {Math.round(focus.tempMinC)}…{Math.round(focus.tempMaxC)}°C
            {focus.precipMm > 0 ? ` · осадки ${focus.precipMm} мм` : ''}
          </p>
          {(focus.sunrise || focus.sunset) && (
            <p className="weather-card-sun">
              {focus.sunrise ? `↑ ${focus.sunrise.slice(11, 16)}` : ''}
              {focus.sunrise && focus.sunset ? ' · ' : ''}
              {focus.sunset ? `↓ ${focus.sunset.slice(11, 16)}` : ''}
            </p>
          )}
        </footer>
      )}
    </div>
  );
}
