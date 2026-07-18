import { useEffect, useRef, useState } from 'react';
import Counter from './Counter';
import Reveal from './Reveal';
import { usePrefs } from '../context/PrefsContext';

const stats = [
  { value: 180, suffix: '+', label: 'В команде' },
  { value: 40, suffix: '+', label: 'Научных работ' },
  { value: 12, suffix: '', label: 'Стран' },
];

export default function Company() {
  const { theme } = usePrefs();
  const [counts, setCounts] = useState([0, 0, 0]);
  const [started, setStarted] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const isLight = theme === 'light';

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started) {
          setStarted(true);
          setCounts(stats.map((s) => s.value));
        }
      },
      { threshold: 0.35 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [started]);

  return (
    <section id="company" ref={sectionRef} className="relative bg-paper py-24 lg:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
          <Reveal>
            <p className="eyebrow mb-3">Компания</p>
            <h2 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-5xl">
              Xelity Inc
            </h2>
            <p className="mt-5 text-base leading-relaxed text-slate sm:text-lg">
              Мы — исследовательская ИИ-компания, которая создаёт системы, на которые можно
              положиться. Штаб-квартира в Сан-Франциско, распределённая команда учёных, инженеров и
              продуктовых специалистов.
            </p>
            <p className="mt-4 text-base leading-relaxed text-slate sm:text-lg">
              Наша миссия: сделать так, чтобы передовой интеллект оставался усилителем человеческих
              амбиций — прозрачным, управляемым и широко полезным.
            </p>

            <div className="mt-10 grid grid-cols-3 gap-4 sm:gap-6">
              {stats.map((stat, i) => (
                <div key={stat.label} className="transition hover:-translate-y-0.5">
                  <div className="flex items-end text-ink">
                    <Counter
                      value={counts[i]}
                      fontSize={28}
                      padding={0}
                      gap={1}
                      horizontalPadding={0}
                      borderRadius={0}
                      gradientHeight={8}
                      gradientFrom={isLight ? '#ffffff' : '#0c0808'}
                      gradientTo="transparent"
                      textColor={isLight ? '#121212' : '#f3ecec'}
                      fontWeight={700}
                      counterStyle={{ letterSpacing: '-0.02em', fontFamily: 'Syne, sans-serif' }}
                    />
                    {stat.suffix && (
                      <span className="font-display mb-0.5 text-2xl font-bold tracking-tight">
                        {stat.suffix}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate">{stat.label}</p>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={140}>
            <div className="relative overflow-hidden rounded-2xl border border-line shadow-lg shadow-ink/5 transition hover:scale-[1.01]">
              <img
                src="https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=1200&q=80"
                alt="Исследования и инфраструктура Xelity"
                className="h-72 w-full object-cover transition duration-700 hover:scale-105 sm:h-80"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-paper via-paper/30 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6">
                <p className="font-display text-sm font-bold text-ink">
                  Строим следующий слой интеллекта
                </p>
                <p className="mt-1 text-xs text-slate">Исследования · Продукт · Инфраструктура</p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
