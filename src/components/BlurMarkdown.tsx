import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Props = {
  content: string;
  /** blur → sharp; false = сразу чёткий текст */
  animate?: boolean;
  className?: string;
  onDone?: () => void;
};

function MarkdownBody({ content, className = '' }: { content: string; className?: string }) {
  return (
    <div
      className={`chat-md min-w-0 max-w-full overflow-x-auto text-[15px] leading-[1.65] text-[var(--c-text)] ${className}`}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

/**
 * Полный markdown сразу (форматирование не ждёт конца анимации) + blur → читаемый текст.
 */
export default function BlurMarkdown({
  content,
  animate = true,
  className = '',
  onDone,
}: Props) {
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const [clear, setClear] = useState(!animate);
  const doneOnce = useRef(false);

  useEffect(() => {
    doneOnce.current = false;
    if (!animate || !content.trim()) {
      setClear(true);
      onDoneRef.current?.();
      return;
    }

    setClear(false);
    let doneTimer: number | undefined;
    const start = window.requestAnimationFrame(() => {
      // следующий кадр — запускаем переход blur → sharp
      window.requestAnimationFrame(() => setClear(true));
      doneTimer = window.setTimeout(() => {
        if (!doneOnce.current) {
          doneOnce.current = true;
          onDoneRef.current?.();
        }
      }, 900);
    });

    return () => {
      window.cancelAnimationFrame(start);
      if (doneTimer) window.clearTimeout(doneTimer);
    };
  }, [content, animate]);

  if (!content.trim()) return null;

  return (
    <div className={`answer-blur ${clear ? 'is-clear' : ''} ${className}`}>
      <MarkdownBody content={content} />
    </div>
  );
}

/** Мысли: сразу весь текст, только blur → sharp */
export function BlurText({
  text,
  animate = true,
  className = '',
}: {
  text: string;
  animate?: boolean;
  className?: string;
}) {
  const [clear, setClear] = useState(!animate);

  useEffect(() => {
    if (!animate) {
      setClear(true);
      return;
    }
    setClear(false);
    const id = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setClear(true));
    });
    return () => window.cancelAnimationFrame(id);
  }, [text, animate]);

  return (
    <p className={`answer-blur whitespace-pre-wrap break-words ${clear ? 'is-clear' : ''} ${className}`}>
      {text}
    </p>
  );
}
