type Props = {
  kind: 'intercept' | 'queue';
  className?: string;
};

/** Плавная карточка «нагрузка на сервер» для god-режимов */
export default function ServerLoadCard({ kind, className = '' }: Props) {
  const title =
    kind === 'queue'
      ? 'Очередь для этого чата'
      : 'Повышенная нагрузка на сервер';
  const body =
    kind === 'queue'
      ? 'Сообщение принято. Вернитесь в этот чат чуть позже — ответ появится, когда освободится слот.'
      : 'Подождите несколько секунд. Мы обрабатываем запрос…';

  return (
    <div className={`server-load-card server-load-card--${kind} ${className}`} role="status">
      <div className="server-load-card-bar" aria-hidden />
      <p className="server-load-card-title">{title}</p>
      <p className="server-load-card-body">{body}</p>
    </div>
  );
}
