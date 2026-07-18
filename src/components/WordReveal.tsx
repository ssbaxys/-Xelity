import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

type Mode = 'words' | 'lines';

type Props = {
  text: string;
  /** words — по словам; lines — по строкам (удобно для мыслей) */
  mode?: Mode;
  /** мс на токен */
  stepMs?: number;
  className?: string;
  /** после полной анимации */
  onDone?: () => void;
  /** если false — сразу полный текст без анимации */
  animate?: boolean;
  /** что показать после завершения (например Markdown) */
  doneSlot?: ReactNode;
};

function splitTokens(text: string, mode: Mode): string[] {
  if (mode === 'lines') {
    const parts = text.split(/(\n+)/);
    return parts.filter((p) => p.length > 0);
  }
  return text.split(/(\s+)/).filter((p) => p.length > 0);
}

/** Плавное появление текста по словам / строкам */
export default function WordReveal({
  text,
  mode = 'words',
  stepMs,
  className = '',
  onDone,
  animate = true,
  doneSlot,
}: Props) {
  const tokens = useMemo(() => splitTokens(text, mode), [text, mode]);
  const delay = stepMs ?? (mode === 'lines' ? 90 : 32);
  const [count, setCount] = useState(animate ? 0 : tokens.length);
  const [finished, setFinished] = useState(!animate);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    if (!animate || !text.trim()) {
      setCount(tokens.length);
      setFinished(true);
      onDoneRef.current?.();
      return;
    }
    setCount(0);
    setFinished(false);
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      if (i < tokens.length && /^\s+$/.test(tokens[i] || '')) {
        i += 1;
      }
      setCount(Math.min(i, tokens.length));
      if (i >= tokens.length) {
        window.clearInterval(id);
        setFinished(true);
        onDoneRef.current?.();
      }
    }, delay);
    return () => window.clearInterval(id);
  }, [text, tokens, delay, animate]);

  if (finished && doneSlot) {
    return <>{doneSlot}</>;
  }

  return (
    <div className={className}>
      {tokens.slice(0, count).map((token, i) => (
        <span key={`${i}-${token.slice(0, 8)}`} className="chat-token-in">
          {token}
        </span>
      ))}
      {!finished && <span className="chat-caret" aria-hidden />}
    </div>
  );
}
