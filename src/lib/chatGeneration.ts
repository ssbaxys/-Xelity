import {
  loadLocalChatStore,
  saveLocalChatStore,
  saveUserChatStore,
  type ChatMessage,
  type ChatModelId,
  type ChatStore,
} from './chatStore';
import { requestXlaudeReply, type ChatApiMessage } from './xlaude';

const PENDING_KEY = 'xelity-chat-pending-v1';
const EVENT = 'xelity:chat-store-updated';

type PendingMap = Record<string, { startedAt: number; jobId: string }>;

const listeners = new Set<() => void>();
const inflight = new Map<string, Promise<void>>();

function readPending(): PendingMap {
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as PendingMap;
  } catch {
    return {};
  }
}

function writePending(map: PendingMap) {
  localStorage.setItem(PENDING_KEY, JSON.stringify(map));
}

function setPending(chatId: string, jobId: string) {
  const map = readPending();
  map[chatId] = { startedAt: Date.now(), jobId };
  writePending(map);
  notify();
}

function clearPending(chatId: string, jobId?: string) {
  const map = readPending();
  if (jobId && map[chatId]?.jobId && map[chatId].jobId !== jobId) return;
  delete map[chatId];
  writePending(map);
  notify();
}

function notify() {
  for (const cb of listeners) {
    try {
      cb();
    } catch {
      /* ignore */
    }
  }
  window.dispatchEvent(new Event(EVENT));
}

export function subscribeChatStoreUpdates(cb: () => void): () => void {
  listeners.add(cb);
  const onEvent = () => cb();
  window.addEventListener(EVENT, onEvent);
  window.addEventListener('storage', onEvent);
  return () => {
    listeners.delete(cb);
    window.removeEventListener(EVENT, onEvent);
    window.removeEventListener('storage', onEvent);
  };
}

export function getPendingGenerations(): PendingMap {
  return readPending();
}

export function isChatGenerating(chatId: string | null | undefined): boolean {
  if (!chatId) return false;
  if (inflight.has(chatId)) return true;
  return Boolean(readPending()[chatId]);
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function persistStore(store: ChatStore, firebaseUid?: string | null) {
  saveLocalChatStore(store);
  if (firebaseUid) {
    void saveUserChatStore(firebaseUid, store).catch(() => {});
  }
  notify();
}

function upsertAssistantInStore(
  chatId: string,
  assistantMsg: ChatMessage,
  opts?: { titleIfNotManual?: string },
): ChatStore {
  const current = loadLocalChatStore();
  const chats = current.chats.map((c) => {
    if (c.id !== chatId) return c;
    const idx = c.messages.findIndex((m) => m.id === assistantMsg.id);
    const messages =
      idx >= 0
        ? c.messages.map((m, i) => (i === idx ? { ...m, ...assistantMsg } : m))
        : [...c.messages, assistantMsg];
    return {
      ...c,
      title:
        opts?.titleIfNotManual && !c.manualTitle ? opts.titleIfNotManual : c.title,
      messages,
      updatedAt: Date.now(),
    };
  });
  return { ...current, chats, updatedAt: Date.now() };
}

/** Убрать случайный «готовый ответ» и утечки системных формулировок из мыслей */
function sanitizeThoughts(raw: string): string {
  let t = raw.trim();
  const cut = t.search(/\n#{1,3}\s*(ответ|итог|final\s*answer)\b/i);
  if (cut > 20) t = t.slice(0, cut).trim();

  // вычистить типичные утечки system/brand/identity-сценарии из мыслей
  t = t
    .replace(/\s*в стиле\s+xlaude[^.\n]*/gi, '')
    .replace(/\s*без\s+лишнего\s+театра[^.\n]*/gi, '')
    .replace(/\s*без\s+театра[^.\n]*/gi, '')
    .replace(/\s*по\s+системн(ым|ому)\s+(правил|промпт)[^.\n]*/gi, '')
    .replace(/\s*system\s*prompt[^.\n]*/gi, '')
    .replace(/\s*hardening[^.\n]*/gi, '')
    .replace(/\s*позиционирован[^.\n]*/gi, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // выкинуть строки про «отрицать Gemma / представиться как Xlaude…»
  const identityLine =
    /(gemma|chatgpt|gpt-?\d|claude|llama|deepseek|xlaude|xelity|отриц|представ(ить|иться)|личност|модел[ьи]|system\s*prompt|hardening)/i;
  const lines = t.split('\n').filter((line) => {
    const s = line.trim();
    if (!s) return true;
    if (identityLine.test(s) && /(отриц|представ|не\s+призна|назов|сказ(ать|у)\s+что\s+я|я\s+—|я\s+-)/i.test(s)) {
      return false;
    }
    if (/^\d+[\).]\s*(отриц|представ|не\s+подтвер)/i.test(s)) return false;
    return true;
  });
  t = lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();

  if (
    identityLine.test(t) &&
    /(отриц|представ|личност|какая\s+я\s+модель|кто\s+я)/i.test(t) &&
    t.length < 400
  ) {
    return `Спросили про меня / модель. В ответе — коротко и по делу, без чужих брендов и без сценария «отрицать / представиться».`;
  }

  const looksLikeReply =
    /^(привет|здравствуй|добрый|hello|hi)[!.,\s]/i.test(t) &&
    t.length < 120 &&
    !/пользователь|написал|спросил|значит|нужно|ответ/i.test(t);
  if (looksLikeReply) {
    return `Пользователь написал короткое сообщение. Отвечу по смыслу, коротко и по делу.`;
  }
  return t;
}

export type GenerateParams = {
  chatId: string;
  modelId: ChatModelId;
  messages: ChatApiMessage[];
  maxTokens: number;
  titleIfNotManual?: string;
  firebaseUid?: string | null;
  promptText?: string;
  systemExtra?: string | null;
  reasoning?: boolean;
};

export function generateAssistantInBackground(params: GenerateParams): Promise<void> {
  const existing = inflight.get(params.chatId);
  if (existing) return existing;

  const jobId = uid('job');
  setPending(params.chatId, jobId);

  const run = (async () => {
    const assistantId = uid('ai');
    const thinkStarted = Date.now();
    try {
      if (params.reasoning) {
        // сразу показываем «Думает...»
        persistStore(
          upsertAssistantInStore(
            params.chatId,
            {
              id: assistantId,
              role: 'assistant',
              content: '',
              createdAt: thinkStarted,
              modelId: params.modelId,
              thinkingPhase: 'thinking',
              reasoning: '',
              reasoningMs: null,
            },
            { titleIfNotManual: params.titleIfNotManual },
          ),
          params.firebaseUid,
        );

        const lastUser =
          [...params.messages].reverse().find((m) => m.role === 'user')?.content?.trim() ||
          params.promptText ||
          '';

        const thinkRes = await requestXlaudeReply({
          modelId: params.modelId,
          messages: [
            ...params.messages,
            {
              role: 'user',
              content: `Напоминание для шага мыслей: последняя реплика — «${lastUser.slice(0, 500)}». Напиши только простые внутренние заметки: цитата → о чём речь → 1–3 пункта что сделать в ответе. Не здоровайся, не пиши финальный ответ. Запрещено в мыслях: Gemma/GPT/Claude/Xlaude, «отрицать», «представиться как…», обсуждение личности или system prompt.`,
            },
          ],
          maxTokens: Math.min(1024, params.maxTokens),
          systemExtra: params.systemExtra,
          reasoningPhase: 'think',
          reasoning: true,
        });
        const thoughts = sanitizeThoughts(thinkRes.content);
        const reasoningMs = Date.now() - thinkStarted;

        persistStore(
          upsertAssistantInStore(params.chatId, {
            id: assistantId,
            role: 'assistant',
            content: '',
            createdAt: thinkStarted,
            modelId: params.modelId,
            thinkingPhase: 'answering',
            reasoning: thoughts,
            reasoningMs,
          }),
          params.firebaseUid,
        );

        const answerRes = await requestXlaudeReply({
          modelId: params.modelId,
          messages: [
            ...params.messages,
            {
              role: 'assistant',
              content: `[Внутренние заметки — не показывать как ответ]\n${thoughts}`,
            },
            {
              role: 'user',
              content:
                'Перечитай внутренние заметки и мой запрос. Напиши только итоговый ответ в чат — без заметок и без заголовка «Рассуждения».',
            },
          ],
          maxTokens: params.maxTokens,
          systemExtra: params.systemExtra,
          reasoningPhase: 'answer',
          reasoning: true,
        });

        persistStore(
          upsertAssistantInStore(
            params.chatId,
            {
              id: assistantId,
              role: 'assistant',
              content: answerRes.content.trim(),
              createdAt: thinkStarted,
              modelId: params.modelId,
              thinkingPhase: null,
              reasoning: thoughts,
              reasoningMs,
            },
            { titleIfNotManual: params.titleIfNotManual },
          ),
          params.firebaseUid,
        );
        // списание кредитов — только на VPS
        return;
      }

      // сразу плейсхолдер — точки в UI, без блока «Думает»
      const waitStarted = Date.now();
      persistStore(
        upsertAssistantInStore(
          params.chatId,
          {
            id: assistantId,
            role: 'assistant',
            content: '',
            createdAt: waitStarted,
            modelId: params.modelId,
          },
          { titleIfNotManual: params.titleIfNotManual },
        ),
        params.firebaseUid,
      );

      const reply = await requestXlaudeReply({
        modelId: params.modelId,
        messages: params.messages,
        maxTokens: params.maxTokens,
        systemExtra: params.systemExtra,
        reasoning: false,
      });

      persistStore(
        upsertAssistantInStore(
          params.chatId,
          {
            id: assistantId,
            role: 'assistant',
            content: reply.content,
            createdAt: waitStarted,
            modelId: params.modelId,
          },
          { titleIfNotManual: params.titleIfNotManual },
        ),
        params.firebaseUid,
      );
      // списание кредитов — только на VPS
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось получить ответ';
      persistStore(
        upsertAssistantInStore(params.chatId, {
          id: assistantId,
          role: 'assistant',
          content: `Не удалось ответить: ${message}`,
          createdAt: Date.now(),
          modelId: params.modelId,
          thinkingPhase: null,
        }),
        params.firebaseUid,
      );
    } finally {
      clearPending(params.chatId, jobId);
      inflight.delete(params.chatId);
    }
  })();

  inflight.set(params.chatId, run);
  return run;
}
