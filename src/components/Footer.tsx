import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const columns = [
  {
    title: 'Продукт',
    links: [
      { label: 'Тарифы', to: '/pricing', desc: 'Free, Pro и Max' },
      { label: 'Обзор', to: '/product', desc: 'Возможности и сценарии' },
      { label: 'Xlaude', to: '/model', desc: 'Mini · Pro · K1 · K2' },
    ],
  },
  {
    title: 'Компания',
    links: [
      { label: 'О нас', to: '/about', desc: 'Миссия и контакты' },
      { label: 'Карьера', to: '/careers', desc: 'Открытые роли' },
      { label: 'Новости', to: '/news', desc: 'Анонсы и даты' },
      { label: 'Бренд', to: '/brand', desc: 'Имя, логотип, цвета' },
      { label: 'Поддержка', to: '/support', desc: 'Тикеты и помощь' },
    ],
  },
  {
    title: 'Разработчикам',
    links: [
      { label: 'API', to: '/api', desc: 'Chat · Search · Weather' },
      { label: 'API кабинет', to: '/account/api', desc: 'Ключи и баланс USD' },
      { label: 'Changelog', to: '/changelog', desc: 'История обновлений' },
    ],
  },
  {
    title: 'Юридическое',
    links: [
      { label: 'Конфиденциальность', to: '/privacy', desc: 'Данные и права' },
      { label: 'Условия', to: '/terms', desc: 'Правила сервиса' },
      { label: 'Безопасность', to: '/safety', desc: 'Устав и инциденты' },
      { label: 'Ответственное использование', to: '/responsible-use', desc: 'Практика для команд' },
    ],
  },
];

const social = [
  { label: 'X', href: 'https://x.com' },
  { label: 'LinkedIn', href: 'https://www.linkedin.com' },
  { label: 'GitHub', href: 'https://github.com' },
  { label: 'Discord', href: 'https://discord.com' },
];

export default function Footer() {
  const { isStaff } = useAuth();
  const navigate = useNavigate();

  return (
    <footer className="relative overflow-hidden border-t border-line bg-mist pb-8 pt-12 sm:pb-10 sm:pt-16">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-signal/50 to-transparent" />
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:gap-x-8 sm:gap-y-12 lg:grid-cols-6 lg:gap-8">
          <div className="col-span-2 lg:col-span-1">
            <Link to="/" className="group inline-flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-signal transition group-hover:scale-105">
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4 text-white"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
                  <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
                </svg>
              </div>
              <span className="font-display text-[15px] font-bold text-ink">Xelity</span>
            </Link>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-slate">
              Меньше театра. Больше ответа — линейка Xlaude без лишнего шоу.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
              <Link
                to="/chat"
                className="inline-flex items-center gap-1 text-sm font-semibold text-signal transition hover:gap-2 hover:text-[#ef5350]"
              >
                Открыть чат
                <span aria-hidden>→</span>
              </Link>
            </div>
          </div>

          {columns.map((col) => (
            <div key={col.title} className="min-w-0">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate/80 sm:mb-4 sm:text-xs">
                {col.title}
              </p>
              <ul className="space-y-2.5 sm:space-y-3.5">
                {col.links.map((link) => (
                  <li key={`${col.title}-${link.label}`}>
                    <Link to={link.to} className="group block min-w-0">
                      <span className="footer-link text-[13px] text-slate transition group-hover:text-ink sm:text-sm">
                        {link.label}
                      </span>
                      <span className="mt-0.5 hidden text-[11px] leading-snug text-slate/55 transition group-hover:text-slate/80 sm:block">
                        {link.desc}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-5 border-t border-line pt-6 sm:mt-14 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:pt-8">
          <div className="min-w-0">
            <p className="text-xs text-slate/70">
              © {new Date().getFullYear()} Xelity Inc. Все права защищены.
            </p>
            <p className="mt-1 break-words text-[11px] text-slate/50">
              Открытая бета · Сан-Франциско ·{' '}
              {isStaff ? (
                <button
                  type="button"
                  onClick={() => navigate('/admin')}
                  className="text-slate/50 underline-offset-2 transition hover:text-signal hover:underline"
                >
                  hello@xelity.ai
                </button>
              ) : (
                <a
                  href="mailto:hello@xelity.ai"
                  className="text-slate/50 underline-offset-2 transition hover:text-signal hover:underline"
                >
                  hello@xelity.ai
                </a>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2 sm:justify-end sm:gap-x-5">
            {social.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-slate/70 transition hover:text-signal"
              >
                {s.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
