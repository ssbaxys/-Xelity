import {
  loadLocalChatStore,
  saveLocalChatStore,
  saveUserChatStore,
  type ChatMessage,
  type ChatModelId,
  type ChatStore,
  type ToolActivity,
  type ToolActivityKind,
} from './chatStore';
import { formatChatFailure } from './chatApiError';
import {
  activityFromWebTool,
  executeRemoteTool,
  WEB_TOOL_NAMES,
} from './agentTools';
import {
  commitSandboxBuild,
  ensureReactSiteTemplate,
  runSandboxTool,
} from './projectSandbox';
import { requestXlaudeReply, type ChatApiMessage, type ToolCall } from './xlaude';

const MAX_TOOL_ROUNDS = 10;
/** Минимальное время серой «pending»-карточки, чтобы UI успел показать часы / спин */
const MIN_TOOL_PENDING_MS = 420;

function sleep(ms: number) {
  return new Promise<void>((r) => window.setTimeout(r, ms));
}

function maybeCommitCodingBuild(chatId: string, coding: boolean, activities: ToolActivity[]) {
  if (!coding) return;
  const wrote = activities.some(
    (a) =>
      a.ok &&
      !a.pending &&
      (a.kind === 'create' || a.kind === 'edit' || a.kind === 'delete'),
  );
  if (!wrote) return;
  const n = activities.filter(
    (a) => a.ok && (a.kind === 'create' || a.kind === 'edit' || a.kind === 'delete'),
  ).length;
  commitSandboxBuild(chatId, n === 1 ? 'Обновление сайта' : `Правки · ${n} файлов`);
}

function pendingKindFor(name: string): ToolActivityKind {
  if (name === 'web_search') return 'search';
  if (name === 'web_fetch') return 'fetch';
  if (name === 'get_weather') return 'weather';
  if (name === 'read_file') return 'read';
  if (name === 'list_files') return 'list';
  if (name === 'delete_file') return 'delete';
  if (name === 'write_file') return 'edit';
  return 'edit';
}

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
  codingTools?: boolean;
  webTools?: boolean;
};

async function runWithAgentTools(params: {
  chatId: string;
  modelId: ChatModelId;
  messages: ChatApiMessage[];
  maxTokens: number;
  systemExtra?: string | null;
  reasoning?: boolean;
  reasoningPhase?: 'think' | 'answer';
  codingTools?: boolean;
  webTools?: boolean;
  assistantId: string;
  createdAt: number;
  firebaseUid?: string | null;
  titleIfNotManual?: string;
  seedThoughts?: string | null;
  seedReasoningMs?: number | null;
  thinkingPhase?: ChatMessage['thinkingPhase'];
}): Promise<{ content: string; toolActivity: ToolActivity[] }> {
  const coding = params.codingTools === true;
  const web = params.webTools !== false;
  const seeded = coding ? ensureReactSiteTemplate(params.chatId) : false;
  const activities: ToolActivity[] = [];

  if (!coding && !web) {
    const reply = await requestXlaudeReply({
      modelId: params.modelId,
      messages: params.messages,
      maxTokens: params.maxTokens,
      systemExtra: params.systemExtra,
      reasoning: params.reasoning,
      reasoningPhase: params.reasoningPhase,
      codingTools: false,
      webTools: false,
    });
    return { content: reply.content.trim(), toolActivity: [] };
  }

  const withReasoning = Boolean(params.reasoning || params.seedThoughts);
  const pushAssistant = (partial: Partial<ChatMessage>) => {
    persistStore(
      upsertAssistantInStore(
        params.chatId,
        {
          id: params.assistantId,
          role: 'assistant',
          content: partial.content ?? '',
          createdAt: params.createdAt,
          modelId: params.modelId,
          // без режима «Рассуждения» не трогаем мысли — иначе мелькает «Думает…»
          thinkingPhase: withReasoning
            ? (partial.thinkingPhase ?? params.thinkingPhase ?? null)
            : null,
          reasoning: withReasoning
            ? (partial.reasoning ?? params.seedThoughts ?? null)
            : null,
          reasoningMs: withReasoning
            ? (partial.reasoningMs ?? params.seedReasoningMs ?? null)
            : null,
          toolActivity: partial.toolActivity ?? activities,
        },
        { titleIfNotManual: params.titleIfNotManual },
      ),
      params.firebaseUid,
    );
  };

  let messages = [...params.messages];
  if (coding && seeded) {
    messages = [
      ...messages,
      {
        role: 'user',
        content:
          '[Системно] В проекте уже есть стартовый шаблон сайта (React/Vite: package.json, index.html, src/App.jsx, src/styles.css и др.). Не пересоздавай шаблон с нуля. Правь под задачу. В ответе пользователю — как заказчику сайта, без упоминания инструментов и имён файловых API.',
      },
    ];
  }

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const reply = await requestXlaudeReply({
      modelId: params.modelId,
      messages,
      maxTokens: params.maxTokens,
      systemExtra: params.systemExtra,
      reasoning: params.reasoning,
      reasoningPhase: params.reasoningPhase,
      codingTools: coding,
      webTools: web,
    });

    const calls = reply.tool_calls || [];
    if (!calls.length) {
      maybeCommitCodingBuild(params.chatId, coding, activities);
      return { content: reply.content.trim(), toolActivity: activities };
    }

    const toolMsgs: ChatApiMessage[] = [];
    for (const tc of calls as ToolCall[]) {
      const name = tc.function.name;
      const argsJson = tc.function.arguments || '{}';
      const pending: ToolActivity = {
        id: tc.id || `p-${activities.length}`,
        name,
        kind: pendingKindFor(name),
        pending: true,
        ok: false,
      };
      try {
        const args = JSON.parse(argsJson) as {
          path?: string;
          query?: string;
          url?: string;
          urls?: string[];
          location?: string;
        };
        if (args.path) pending.path = String(args.path);
        else if (args.location) pending.path = String(args.location);
        else if (args.query) pending.path = String(args.query);
        else if (Array.isArray(args.urls) && args.urls.length > 1) {
          pending.path = `${args.urls.length} стр.`;
        } else if (args.url) pending.path = String(args.url);
        else if (Array.isArray(args.urls) && args.urls[0]) {
          pending.path = String(args.urls[0]);
        }
      } catch {
        /* ignore */
      }
      activities.push(pending);
      pushAssistant({ content: '', toolActivity: [...activities] });
      const pendingStarted = Date.now();

      let forModel = '';
      let done: ToolActivity;
      if (WEB_TOOL_NAMES.has(name)) {
        try {
          const remote = await executeRemoteTool(name, argsJson);
          done = activityFromWebTool(pending.id, name, argsJson, remote);
          forModel = remote.content || remote.error || 'empty';
        } catch (err) {
          const msg =
            err && typeof err === 'object' && 'detail' in err && typeof (err as { detail?: string }).detail === 'string'
              ? (err as { detail: string }).detail
              : err instanceof Error
                ? err.message
                : 'Ошибка tool';
          const userMsg =
            err instanceof Error && err.message && !/^fetch failed$/i.test(err.message)
              ? err.message
              : 'Поиск временно недоступен. Попробуйте ещё раз через минуту.';
          done = {
            ...pending,
            pending: false,
            ok: false,
            error: userMsg,
            after: msg,
          };
          forModel = `Error: ${msg}`;
        }
      } else if (coding) {
        const run = runSandboxTool(params.chatId, name, argsJson, tc.id);
        done = run.activity;
        forModel = run.forModel;
      } else {
        done = {
          ...pending,
          pending: false,
          ok: false,
          error: 'Tool недоступен в этом режиме',
        };
        forModel = `Error: tool ${name} unavailable (enable coding mode for file tools)`;
      }

      const wait = MIN_TOOL_PENDING_MS - (Date.now() - pendingStarted);
      if (wait > 0) await sleep(wait);

      const idx = activities.findIndex((a) => a.id === pending.id);
      if (idx >= 0) activities[idx] = done;
      else activities.push(done);
      pushAssistant({ content: '', toolActivity: [...activities] });

      toolMsgs.push({
        role: 'tool',
        tool_call_id: tc.id,
        name,
        content: forModel,
      });
    }

    messages = [
      ...messages,
      {
        role: 'assistant',
        content: reply.content || '',
        tool_calls: calls,
      },
      ...toolMsgs,
    ];
  }
  maybeCommitCodingBuild(params.chatId, coding, activities);
  return {
    content: 'Слишком много шагов. Упростите задачу или продолжите в следующем сообщении.',
    toolActivity: activities,
  };
}

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

        const answerMessages: ChatApiMessage[] = [
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
        ];

        const coded = await runWithAgentTools({
          chatId: params.chatId,
          modelId: params.modelId,
          messages: answerMessages,
          maxTokens: params.maxTokens,
          systemExtra: params.systemExtra,
          reasoning: true,
          reasoningPhase: 'answer',
          codingTools: params.codingTools,
          webTools: params.webTools,
          assistantId,
          createdAt: thinkStarted,
          firebaseUid: params.firebaseUid,
          titleIfNotManual: params.titleIfNotManual,
          seedThoughts: thoughts,
          seedReasoningMs: reasoningMs,
          thinkingPhase: 'answering',
        });
        const answerContent = coded.content;
        const toolActivity = coded.toolActivity.length ? coded.toolActivity : undefined;

        persistStore(
          upsertAssistantInStore(
            params.chatId,
            {
              id: assistantId,
              role: 'assistant',
              content: answerContent,
              createdAt: thinkStarted,
              modelId: params.modelId,
              thinkingPhase: null,
              reasoning: thoughts,
              reasoningMs,
              toolActivity,
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

      const coded = await runWithAgentTools({
        chatId: params.chatId,
        modelId: params.modelId,
        messages: params.messages,
        maxTokens: params.maxTokens,
        systemExtra: params.systemExtra,
        reasoning: false,
        codingTools: params.codingTools,
        webTools: params.webTools,
        assistantId,
        createdAt: waitStarted,
        firebaseUid: params.firebaseUid,
        titleIfNotManual: params.titleIfNotManual,
        thinkingPhase: null,
      });
      const replyContent = coded.content;
      const toolActivity = coded.toolActivity.length ? coded.toolActivity : undefined;

      persistStore(
        upsertAssistantInStore(
          params.chatId,
          {
            id: assistantId,
            role: 'assistant',
            content: replyContent,
            createdAt: waitStarted,
            modelId: params.modelId,
            thinkingPhase: null,
            reasoning: null,
            reasoningMs: null,
            toolActivity,
          },
          { titleIfNotManual: params.titleIfNotManual },
        ),
        params.firebaseUid,
      );
      // списание кредитов — только на VPS
    } catch (err) {
      const { content, errorDetail } = formatChatFailure(err);
      persistStore(
        upsertAssistantInStore(params.chatId, {
          id: assistantId,
          role: 'assistant',
          content,
          createdAt: Date.now(),
          modelId: params.modelId,
          thinkingPhase: null,
          errorDetail,
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
