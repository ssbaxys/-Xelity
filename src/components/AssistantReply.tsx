import { useEffect, useRef, useState } from 'react';
import BlurMarkdown from './BlurMarkdown';
import ReasoningPanel from './ReasoningPanel';
import ToolActivityCards from './ToolActivityCards';
import TypingDots from './TypingDots';
import type { ToolActivity } from '../lib/chatStore';
import { modelLabel, normalizeModelId, type ChatModelId } from '../lib/models';

type ThinkingPhase = 'thinking' | 'answering' | null | undefined;

type Props = {
  content: string;
  modelId: ChatModelId | string | null | undefined;
  reasoning?: string | null;
  reasoningMs?: number | null;
  thinkingPhase?: ThinkingPhase;
  createdAt: number;
  live?: boolean;
  toolActivity?: ToolActivity[];
};

/** Ответ: точки → мысли → карточки tools → markdown */
export default function AssistantReply({
  content,
  modelId,
  reasoning,
  reasoningMs,
  thinkingPhase,
  createdAt,
  live = false,
  toolActivity,
}: Props) {
  const hasContent = Boolean(content?.trim());
  const hasReasoning = Boolean(reasoning?.trim());
  const hasTools = Boolean(toolActivity?.length);
  const thinking = thinkingPhase === 'thinking' || thinkingPhase === 'answering';

  const [dotsExit, setDotsExit] = useState(false);
  // точки только пока ждём ответ без блока мыслей
  const [showDots, setShowDots] = useState(!hasContent && !hasReasoning && !thinking);
  const [showAnswer, setShowAnswer] = useState(hasContent && !live);
  const [animateAnswer, setAnimateAnswer] = useState(false);
  const seenRef = useRef<string | null>(hasContent && !live ? content : null);

  useEffect(() => {
    // мысли / tools / ответ уже на экране — точки не нужны
    if (hasContent || hasReasoning || thinking || hasTools) {
      setDotsExit(true);
      const t = window.setTimeout(() => setShowDots(false), 180);
      return () => window.clearTimeout(t);
    }
    // обычная генерация без reasoning: ждём контент
    if (live) {
      setShowDots(true);
      setDotsExit(false);
    }
  }, [hasContent, hasReasoning, live, thinking, hasTools]);

  useEffect(() => {
    if (!hasContent) {
      setShowAnswer(false);
      setAnimateAnswer(false);
      seenRef.current = null;
      return;
    }
    // уже показали этот текст — не трогаем animate, чтобы не оборвать blur
    if (seenRef.current === content) {
      setShowAnswer(true);
      return;
    }
    const delay = showDots || dotsExit ? 200 : 40;
    const t = window.setTimeout(() => {
      setShowAnswer(true);
      setAnimateAnswer(true);
      seenRef.current = content;
    }, delay);
    return () => window.clearTimeout(t);
  }, [hasContent, content, showDots, dotsExit]);

  const showReasoningBlock = thinking || hasReasoning;

  return (
    <div className="min-w-0">
      <p className="mb-1.5 text-[11px] font-medium text-[var(--c-faint)]">
        {modelLabel(normalizeModelId(modelId))}
      </p>

      {showReasoningBlock && (
        <ReasoningPanel
          reasoning={reasoning}
          reasoningMs={reasoningMs}
          thinkingPhase={thinkingPhase}
          startedAt={createdAt}
          animateThoughts
        />
      )}

      {showDots && !hasContent && !hasReasoning && !thinking && !hasTools && (
        <div className="mt-1 min-h-[1.5rem]">
          <TypingDots exiting={dotsExit} />
        </div>
      )}

      {hasTools && toolActivity && <ToolActivityCards items={toolActivity} />}

      {showAnswer && hasContent && (
        <div className="assistant-answer-wrap">
          <BlurMarkdown content={content} animate={animateAnswer} />
        </div>
      )}
    </div>
  );
}
