import { get, onValue, ref, set, type Unsubscribe } from 'firebase/database';
import { database } from './firebase';
import { normalizeModelId, type ChatModelId } from './models';

export type { ChatModelId } from './models';
export type ChatRole = 'user' | 'assistant';

export type ToolActivityKind = 'list' | 'read' | 'create' | 'edit' | 'delete';

/** Карточка tool-шага в ответе (кодинг) */
export type ToolActivity = {
  id: string;
  name: string;
  kind: ToolActivityKind;
  path?: string;
  ok: boolean;
  error?: string;
  startLine?: number;
  endLine?: number;
  /** содержимое до записи (для diff) */
  before?: string;
  /** содержимое после записи / фрагмент чтения */
  after?: string;
  pending?: boolean;
};

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  /** если сообщение отправил админ от лица пользователя */
  viaAdmin?: boolean;
  /** модель, которой сгенерирован ответ ассистента */
  modelId?: ChatModelId | null;
  /** внутренние рассуждения (не смешивать с content) */
  reasoning?: string | null;
  /** длительность фазы мышления, мс */
  reasoningMs?: number | null;
  /**
   * thinking — идёт шаг мыслей
   * answering — мысли готовы, пишется ответ
   * null/undefined — обычное сообщение или всё готово
   */
  thinkingPhase?: 'thinking' | 'answering' | null;
  /** пользователь отправил с включённым режимом «Рассуждения» */
  usedReasoning?: boolean;
  /** шаги tools в режиме кодинга */
  toolActivity?: ToolActivity[];
};

export type ChatThread = {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  pinned: boolean;
  folderId: string | null;
  modelId: ChatModelId;
  manualTitle: boolean;
  /**
   * Админский system prompt только для этого чата.
   * Пользовательский UI его не показывает и не редактирует.
   */
  adminSystemPrompt?: string | null;
  /** Режим «Рассуждения» — расширенный ход мысли в ответе */
  reasoning?: boolean;
  /** Режим кодинга — tools песочницы сайта */
  codingTools?: boolean;
  /** Черновик поля ввода — свой для каждого чата */
  draft?: string;
};

export type ChatFolder = {
  id: string;
  title: string;
  createdAt: number;
  expanded: boolean;
};

export type ChatStore = {
  chats: ChatThread[];
  folders: ChatFolder[];
  activeId: string | null;
  updatedAt?: number;
};

export const LOCAL_CHAT_KEY = 'xelity-chat-v3';

export function emptyChatStore(): ChatStore {
  return { chats: [], folders: [], activeId: null };
}

export function normalizeChatStore(raw: unknown): ChatStore {
  if (!raw || typeof raw !== 'object') return emptyChatStore();
  const parsed = raw as Partial<ChatStore>;
  return {
    chats: Array.isArray(parsed.chats)
      ? parsed.chats.map((c) => ({
          ...c,
          messages: Array.isArray(c.messages)
            ? c.messages.map((m) => ({
                ...m,
                modelId: m.modelId ? normalizeModelId(m.modelId) : m.modelId ?? null,
                reasoning: typeof m.reasoning === 'string' ? m.reasoning : m.reasoning ?? null,
                reasoningMs:
                  typeof m.reasoningMs === 'number' ? m.reasoningMs : m.reasoningMs ?? null,
                thinkingPhase:
                  m.thinkingPhase === 'thinking' || m.thinkingPhase === 'answering'
                    ? m.thinkingPhase
                    : null,
                usedReasoning: Boolean(m.usedReasoning),
                toolActivity: Array.isArray(m.toolActivity)
                  ? m.toolActivity
                      .filter((t) => t && typeof t === 'object')
                      .map((t) => ({
                        id: String(t.id || ''),
                        name: String(t.name || ''),
                        kind: (['list', 'read', 'create', 'edit', 'delete'] as const).includes(
                          t.kind as ToolActivityKind,
                        )
                          ? (t.kind as ToolActivityKind)
                          : 'edit',
                        path: typeof t.path === 'string' ? t.path : undefined,
                        ok: Boolean(t.ok),
                        error: typeof t.error === 'string' ? t.error : undefined,
                        startLine: typeof t.startLine === 'number' ? t.startLine : undefined,
                        endLine: typeof t.endLine === 'number' ? t.endLine : undefined,
                        before: typeof t.before === 'string' ? t.before.slice(0, 80_000) : undefined,
                        after: typeof t.after === 'string' ? t.after.slice(0, 80_000) : undefined,
                        pending: Boolean(t.pending),
                      }))
                      .filter((t) => t.id && t.name)
                  : undefined,
              }))
            : [],
          manualTitle: Boolean(c.manualTitle),
          pinned: Boolean(c.pinned),
          folderId: c.folderId ?? null,
          modelId: normalizeModelId(c.modelId),
          adminSystemPrompt:
            typeof c.adminSystemPrompt === 'string' ? c.adminSystemPrompt : c.adminSystemPrompt ?? null,
          reasoning: Boolean(c.reasoning),
          codingTools: Boolean(c.codingTools),
          draft: typeof c.draft === 'string' ? c.draft.slice(0, 2000) : '',
        }))
      : [],
    folders: Array.isArray(parsed.folders) ? parsed.folders : [],
    activeId: parsed.activeId ?? null,
    updatedAt: parsed.updatedAt,
  };
}

export function loadLocalChatStore(): ChatStore {
  try {
    const raw = localStorage.getItem(LOCAL_CHAT_KEY);
    if (!raw) return emptyChatStore();
    return normalizeChatStore(JSON.parse(raw));
  } catch {
    return emptyChatStore();
  }
}

export function saveLocalChatStore(store: ChatStore) {
  const payload = { ...store, updatedAt: Date.now() };
  localStorage.setItem(LOCAL_CHAT_KEY, JSON.stringify(payload));
}

export async function fetchUserChatStore(uid: string): Promise<ChatStore | null> {
  const snap = await get(ref(database, `userChats/${uid}`));
  if (!snap.exists()) return null;
  return normalizeChatStore(snap.val());
}

export async function saveUserChatStore(uid: string, store: ChatStore): Promise<void> {
  const payload: ChatStore = {
    ...store,
    updatedAt: Date.now(),
  };
  await set(ref(database, `userChats/${uid}`), payload);
}

export function watchUserChatStore(uid: string, cb: (store: ChatStore | null) => void): Unsubscribe {
  return onValue(ref(database, `userChats/${uid}`), (snap) => {
    cb(snap.exists() ? normalizeChatStore(snap.val()) : null);
  });
}

export function watchAllUserChatIndexes(
  cb: (list: { uid: string; updatedAt: number; threadCount: number; messageCount: number }[]) => void,
): Unsubscribe {
  return onValue(ref(database, 'userChats'), (snap) => {
    if (!snap.exists()) {
      cb([]);
      return;
    }
    const val = snap.val() as Record<string, ChatStore>;
    cb(
      Object.entries(val)
        .map(([uid, store]) => {
          const s = normalizeChatStore(store);
          return {
            uid,
            updatedAt: s.updatedAt || 0,
            threadCount: s.chats.length,
            messageCount: s.chats.reduce((n, c) => n + c.messages.length, 0),
          };
        })
        .sort((a, b) => b.updatedAt - a.updatedAt),
    );
  });
}

export async function adminAppendUserMessage(params: {
  uid: string;
  chatId: string;
  content: string;
}): Promise<ChatStore> {
  const current = (await fetchUserChatStore(params.uid)) ?? emptyChatStore();
  const now = Date.now();
  const msg: ChatMessage = {
    id: `admin-${now}-${Math.random().toString(36).slice(2, 7)}`,
    role: 'user',
    content: params.content.trim(),
    createdAt: now,
    viaAdmin: true,
  };
  const chats = current.chats.map((c) =>
    c.id === params.chatId
      ? {
          ...c,
          messages: [...c.messages, msg],
          updatedAt: now,
        }
      : c,
  );
  if (!chats.some((c) => c.id === params.chatId)) {
    throw new Error('Чат не найден');
  }
  const next: ChatStore = { ...current, chats, activeId: params.chatId, updatedAt: now };
  await saveUserChatStore(params.uid, next);
  return next;
}

export async function adminAppendAssistantMessage(params: {
  uid: string;
  chatId: string;
  content: string;
}): Promise<ChatStore> {
  const current = (await fetchUserChatStore(params.uid)) ?? emptyChatStore();
  const now = Date.now();
  const thread = current.chats.find((c) => c.id === params.chatId);
  const msg: ChatMessage = {
    id: `ai-${now}-${Math.random().toString(36).slice(2, 7)}`,
    role: 'assistant',
    content: params.content.trim(),
    createdAt: now,
    viaAdmin: true,
    modelId: thread ? normalizeModelId(thread.modelId) : null,
  };
  const chats = current.chats.map((c) =>
    c.id === params.chatId
      ? { ...c, messages: [...c.messages, msg], updatedAt: now }
      : c,
  );
  const next: ChatStore = { ...current, chats, updatedAt: now };
  await saveUserChatStore(params.uid, next);
  return next;
}

export async function adminDeleteChatThread(uid: string, chatId: string): Promise<ChatStore> {
  const current = (await fetchUserChatStore(uid)) ?? emptyChatStore();
  const chats = current.chats.filter((c) => c.id !== chatId);
  const next: ChatStore = {
    ...current,
    chats,
    activeId: current.activeId === chatId ? chats[0]?.id ?? null : current.activeId,
    updatedAt: Date.now(),
  };
  await saveUserChatStore(uid, next);
  return next;
}

export async function adminWipeAllChats(uid: string): Promise<ChatStore> {
  const next: ChatStore = {
    chats: [],
    folders: [],
    activeId: null,
    updatedAt: Date.now(),
  };
  await saveUserChatStore(uid, next);
  return next;
}

export type ChatEvidenceHit = {
  chatId: string;
  chatTitle: string;
  messageId: string;
  role: ChatRole;
  content: string;
  createdAt: number;
  viaAdmin?: boolean;
};

export function searchChatEvidence(store: ChatStore, query: string): ChatEvidenceHit[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const hits: ChatEvidenceHit[] = [];
  for (const chat of store.chats) {
    for (const m of chat.messages) {
      if ((m.content || '').toLowerCase().includes(q)) {
        hits.push({
          chatId: chat.id,
          chatTitle: chat.title || 'Без названия',
          messageId: m.id,
          role: m.role,
          content: m.content,
          createdAt: m.createdAt,
          viaAdmin: m.viaAdmin,
        });
      }
    }
  }
  return hits.sort((a, b) => b.createdAt - a.createdAt);
}

export async function adminSetChatSystemPrompt(
  uid: string,
  chatId: string,
  prompt: string | null,
): Promise<ChatStore> {
  const current = (await fetchUserChatStore(uid)) ?? emptyChatStore();
  const value = (prompt || '').trim() || null;
  const chats = current.chats.map((c) =>
    c.id === chatId ? { ...c, adminSystemPrompt: value, updatedAt: Date.now() } : c,
  );
  if (!chats.some((c) => c.id === chatId)) throw new Error('Чат не найден');
  const next: ChatStore = { ...current, chats, updatedAt: Date.now() };
  await saveUserChatStore(uid, next);
  return next;
}
