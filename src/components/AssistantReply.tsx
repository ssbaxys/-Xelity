import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import ReasoningPanel from './ReasoningPanel';
import TypingDots from './TypingDots';
import WordReveal from './WordReveal';
import { modelLabel, normalizeModelId, type ChatModelId } from '../lib/models';

type ThinkingPhase = 'thinking' | 'answering' | null | undefined;

type Props = {
  content: string;
  modelId: ChatModelId | string | null | undefined;
  reasoning?: string | null;
  reasoningMs?: number | null;
  thinkingPhase?: ThinkingPhase;
  createdAt: number;
  /** идёт генерация этого сообщения */
  live?: boolean;
};

function MarkdownBody({ content }: { content: string }) {
  return (
    <div className="chat-md min-w-0 max-w-full overflow-x-auto text-[15px] leading-[1.65] text-[var(--c-text)]">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

/**
 * Ответ ассистента: точки → мысли → ответ по словам.
 */
export default function AssistantReply({
  content,
  modelId,
  reasoning,
  reasoningMs,
  thinkingPhase,
  createdAt,
  live = false,
}: Props) {
  const hasContent = Boolean(content?.trim());
  const hasReasoning = Boolean(reasoning?.trim());
  const thinking = thinkingPhase === 'thinking' || thinkingPhase === 'answering';

  const [dotsExit, setDotsExit] = useState(false);
  const [showDots, setShowDots] = useState(!hasContent);
  const [thoughtsReady, setThoughtsReady] = useState(false);
  const [answerReady, setAnswerReady] = useState(hasContent && !live);
  const [revealAnswer, setRevealAnswer] = useState(false);
  const [answerDone, setAnswerDone] = useState(hasContent && !live);
  const revealedFor = useRef<string | null>(hasContent && !live ? content : null);

  // Точки, пока ждём мысли/ответ; потом плавно гасим
  useEffect(() => {
    if (hasContent || hasReasoning) {
      setDotsExit(true);
      const t = window.setTimeout(() => setShowDots(false), 360);
      return () => window.clearTimeout(t);
    }
    if (live || thinking) {
      setShowDots(true);
      setDotsExit(false);
    }
  }, [hasContent, hasReasoning, live, thinking]);

  // Когда появились мысли — плавный reveal
  useEffect(() => {
    if (hasReasoning) {
      setThoughtsReady(true);
    }
  }, [hasReasoning]);

  // После контента — сначала дождаться исчезновения точек, потом word reveal
  useEffect(() => {
    if (!hasContent) {
      setRevealAnswer(false);
      setAnswerDone(false);
      setAnswerReady(false);
      revealedFor.current = null;
      return;
    }
    // уже показывали этот текст — без повторной анимации (переключение чатов)
    if (revealedFor.current === content) {
      setAnswerDone(true);
      setRevealAnswer(false);
      setAnswerReady(true);
      return;
    }
    setAnswerReady(true);
    const delay = showDots || dotsExit ? 340 : 80;
    const t = window.setTimeout(() => {
      setRevealAnswer(true);
      revealedFor.current = content;
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
          animateThoughts={thoughtsReady}
        />
      )}

      {showDots && !hasContent && !hasReasoning && (
        <div className="mt-1 min-h-[1.5rem]">
          <TypingDots exiting={dotsExit} />
        </div>
      )}

      {answerReady && hasContent && (
        <div className="assistant-answer-wrap">
          {answerDone || !revealAnswer ? (
            answerDone ? (
              <div className="answer-settle">
                <MarkdownBody content={content} />
              </div>
            ) : (
              <TypingDots />
            )
          ) : (
            <WordReveal
              text={content}
              mode="words"
              stepMs={30}
              className="whitespace-pre-wrap text-[15px] leading-[1.65] text-[var(--c-text)]"
              onDone={() => setAnswerDone(true)}
              doneSlot={
                <div className="answer-settle">
                  <MarkdownBody content={content} />
                </div>
              }
            />
          )}
        </div>
      )}
    </div>
  );
}
