type Props = {
  /** плавное исчезновение */
  exiting?: boolean;
  className?: string;
};

/** Три точки ожидания ответа */
export default function TypingDots({ exiting = false, className = '' }: Props) {
  return (
    <div
      className={`typing-dots inline-flex items-center gap-1 py-1 ${exiting ? 'is-exit' : 'is-enter'} ${className}`}
      aria-hidden
    >
      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[var(--c-faint)]" />
      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[var(--c-faint)]" />
      <span className="typing-dot h-1.5 w-1.5 rounded-full bg-[var(--c-faint)]" />
    </div>
  );
}
