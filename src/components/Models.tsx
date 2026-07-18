import { Link } from 'react-router-dom';
import Reveal from './Reveal';
import { MODELS } from '../lib/models';

export default function Models() {
  return (
    <section id="models" className="relative bg-mist py-24 lg:py-32">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
      <div className="mx-auto max-w-6xl px-6">
        <Reveal className="max-w-2xl">
          <p className="eyebrow mb-3">Модели</p>
          <h2 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-5xl">
            Линейка Xlaude
          </h2>
          <p className="mt-5 text-base leading-relaxed text-slate sm:text-lg">
            Три модели в одном чате: компактный Mini K1, профессиональный Pro K1 и анонсированное
            новое поколение Mini K2. Стоимость ответа — в кредитах.
          </p>
        </Reveal>

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {MODELS.map((m, i) => (
            <Reveal key={m.id} delay={80 + i * 80}>
              <div className="h-full rounded-2xl border border-signal/25 bg-elevated p-6 shadow-[0_0_0_1px_rgba(198,40,40,0.08),0_18px_48px_rgba(0,0,0,0.28)] sm:p-7">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-lg font-bold text-ink">{m.name}</h3>
                  <span className="rounded bg-signal/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                    {m.generation}
                  </span>
                </div>
                <p className="mb-6 text-sm leading-relaxed text-slate">{m.desc}</p>
                <div className="grid grid-cols-2 gap-3 border-t border-line pt-5">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate">Кредиты</p>
                    <p className="mt-1 text-sm font-semibold text-ink">{m.creditCost} / ответ</p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate">Поколение</p>
                    <p className="mt-1 text-sm font-semibold text-ink">{m.generation}</p>
                  </div>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={280} className="mt-8">
          <div className="flex flex-wrap gap-3">
            <Link to="/chat" className="btn-primary">
              Открыть чат
            </Link>
            <Link to="/model" className="btn-ghost">
              Подробнее
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
