import Reveal from './Reveal';

const capabilities = [
  {
    title: 'Глубокое мышление',
    description:
      'Многошаговый анализ, структурированное планирование и аккуратная оценка компромиссов — без шума.',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
      </svg>
    ),
  },
  {
    title: 'Код и системы',
    description:
      'Пишите, ревьюйте и рефакторьте продакшен-код. Отлаживайте сложные системы с полным контекстом.',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
      </svg>
    ),
  },
  {
    title: 'Xelity Search',
    description:
      'Веб-поиск в чате и через API: источники, сниппеты и картинки.',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
      </svg>
    ),
  },
  {
    title: 'API и Weather',
    description:
      'Ключи xel_…, модели по id Xlaude и Xelity Weather — прогноз в API и в чате, баланс в личном кабинете.',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
      </svg>
    ),
  },
];

export default function Product() {
  return (
    <section id="product" className="relative overflow-hidden bg-paper py-24 lg:py-32">
      <div className="pointer-events-none absolute inset-0 section-grid opacity-70" />
      <div className="relative mx-auto max-w-6xl px-6">
        <Reveal className="max-w-2xl">
          <p className="eyebrow mb-3">Продукт</p>
          <h2 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-5xl">
            Один интерфейс.
            <br />
            Передовые возможности.
          </h2>
          <p className="mt-5 text-base leading-relaxed text-slate sm:text-lg">
            Xelity создан для задач, где важны ясность, точность и контроль — а не эффектные демо.
          </p>
        </Reveal>

        <div className="stagger mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {capabilities.map((cap, i) => (
            <Reveal key={cap.title} delay={i * 70}>
              <div className="panel group h-full p-6">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-mist text-azure transition group-hover:scale-110">
                  {cap.icon}
                </div>
                <h3 className="mb-2 text-[15px] font-semibold text-ink">{cap.title}</h3>
                <p className="text-sm leading-relaxed text-slate">{cap.description}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
