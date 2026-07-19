import { useEffect, useRef, useState } from 'react';
import ChatMarkdown from './ChatMarkdown';

type Props = {
  content: string;
  /** blur → sharp; false = сразу чёткий текст */
  animate?: boolean;
  className?: string;
  onDone?: () => void;
};

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
      <ChatMarkdown content={content} />
    </div>
  );
}

/** Мысли: сразу весь текст, blur → sharp (как у ответа) */
export function BlurText({
  text,
  animate = true,
  className = '',
}: {
  text: string;
  animate?: boolean;
  className?: string;
}) {
  // всегда стартуем с blur при анимации, иначе transition не виден
  const [clear, setClear] = useState(false);

  useEffect(() => {
    if (!animate || !text.trim()) {
      setClear(true);
      return;
    }
    setClear(false);
    let clearTimer: number | undefined;
    const start = window.requestAnimationFrame(() => {
      // кадр с blur, затем снимаем — CSS transition отрабатывает
      clearTimer = window.setTimeout(() => setClear(true), 40);
    });
    return () => {
      window.cancelAnimationFrame(start);
      if (clearTimer) window.clearTimeout(clearTimer);
    };
  }, [text, animate]);

  return (
    <p
      className={`answer-blur thought-blur whitespace-pre-wrap break-words ${clear ? 'is-clear' : ''} ${className}`}
    >
      {text}
    </p>
  );
}
