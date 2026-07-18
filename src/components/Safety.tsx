import Reveal from './Reveal';

const principles = [
  {
    num: '01',
    title: 'Полезность по замыслу',
    text: 'Оптимизируем под реальную пользу — не под трюки вовлечённости и не под лесть.',
  },
  {
    num: '02',
    title: 'Честность под давлением',
    text: 'Предпочитаем калиброванную неопределённость уверенной выдумке. Говорим, когда не знаем.',
  },
  {
    num: '03',
    title: 'Безопасность на практике',
    text: 'Отказываем в очевидном вреде, оставаясь максимально полезными для легитимной работы.',
  },
  {
    num: '04',
    title: 'Прозрачные решения',
    text: 'Даём командам видимость поведения модели, оценок и контролей развёртывания.',
  },
];

export default function Safety() {
  return (
    <section id="safety" className="relative overflow-hidden bg-mist py-24 lg:py-32">
      <div className="relative mx-auto max-w-6xl px-6">
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-20">
          <Reveal>
            <p className="eyebrow mb-3">Безопасность и ценности</p>
            <h2 className="font-display text-3xl font-bold tracking-tight text-ink sm:text-5xl">
              Создано, чтобы заслужить доверие
            </h2>
            <p className="mt-5 text-base leading-relaxed text-slate sm:text-lg">
              Xelity Inc существует, чтобы развивать ИИ, который безопасен, управляем и полезен.
              Возможности без выравнивания — это не прогресс, а отложенный риск.
            </p>
            <a
              href="#company"
              className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-azure transition hover:gap-3 hover:text-ink"
            >
              Читать наш устав
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </a>
          </Reveal>

          <div className="stagger grid gap-4 sm:grid-cols-2">
            {principles.map((p, i) => (
              <Reveal key={p.num} delay={i * 70}>
                <div className="h-full rounded-2xl border border-line bg-elevated p-5 transition hover:-translate-y-1 hover:border-azure/35 hover:shadow-lg hover:shadow-black/20">
                  <span className="font-display text-xs font-bold text-signal">{p.num}</span>
                  <h3 className="mt-2 text-[15px] font-semibold text-ink">{p.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate">{p.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
