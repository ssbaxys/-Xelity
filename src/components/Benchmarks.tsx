import { Link } from 'react-router-dom';
import Reveal from './Reveal';
import {
  BENCH_META,
  BENCH_MODEL_COLS,
  PUBLIC_BENCHMARKS,
  XELITY_BENCHMARKS,
  formatBenchScore,
  type BenchMetric,
} from '../lib/benchmarks';

function BenchTable({ title, rows }: { title: string; rows: BenchMetric[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-elevated">
      <div className="border-b border-line px-4 py-3 sm:px-5">
        <h3 className="font-display text-base font-bold text-ink sm:text-lg">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[42rem] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-line text-[10px] uppercase tracking-wider text-slate">
              <th className="px-4 py-3 font-medium sm:px-5">Метрика</th>
              {BENCH_MODEL_COLS.map((c) => (
                <th key={c.id} className="px-3 py-3 text-right font-medium tabular-nums">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-line/70 last:border-0">
                <td className="px-4 py-3 align-top sm:px-5">
                  <span className="font-medium text-ink">{row.name}</span>
                  {row.note ? (
                    <span className="mt-0.5 block text-[11px] text-slate">{row.note}</span>
                  ) : null}
                </td>
                {BENCH_MODEL_COLS.map((c) => (
                  <td
                    key={c.id}
                    className="px-3 py-3 text-right tabular-nums text-ink"
                  >
                    {formatBenchScore(row.scores[c.id], row.unit)}
                    {row.unit === 'tok/s' && row.scores[c.id] != null ? (
                      <span className="text-slate"> tok/s</span>
                    ) : null}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function Benchmarks() {
  return (
    <section id="benchmarks" className="relative bg-paper py-24 lg:py-32">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-line to-transparent" />
      <div className="mx-auto max-w-6xl px-6">
        <Reveal className="max-w-2xl">
          <p className="eyebrow mb-3">Оценки</p>
          <h2 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-5xl">
            Xelity Eval Lab
          </h2>
          <p className="mt-5 text-base leading-relaxed text-slate sm:text-lg">
            {BENCH_META.asOf}: прогоны по открытым бенчмаркам и собственным наборам Xelity.
            Pro K2 — флагман линейки; Mini — быстрее и дешевле по кредитам.
          </p>
        </Reveal>

        <Reveal delay={80} className="mt-10">
          <BenchTable title="Открытые бенчмарки" rows={PUBLIC_BENCHMARKS} />
        </Reveal>

        <Reveal delay={140} className="mt-6">
          <BenchTable title="Наборы Xelity" rows={XELITY_BENCHMARKS} />
        </Reveal>

        <Reveal delay={200} className="mt-6 max-w-3xl">
          <p className="text-sm leading-relaxed text-slate">{BENCH_META.methodology}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/model" className="btn-ghost">
              Страница моделей
            </Link>
            <Link to="/chat" className="btn-primary">
              Открыть чат
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
