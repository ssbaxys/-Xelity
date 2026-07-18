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
    title: 'Режим исследований',
    description:
      'Синтезируйте статьи, данные и документы в ясные выводы с проверяемыми источниками.',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
      </svg>
    ),
  },
  {
    title: 'Корпоративный контроль',
    description:
      'SSO, журналы аудита, политики хранения данных и приватные развёртывания для регулируемых отраслей.',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
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
