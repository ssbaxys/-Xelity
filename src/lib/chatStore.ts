import { get, onValue, ref, set, type Unsubscribe } from 'firebase/database';
import { database } from './firebase';
import { normalizeModelId, type ChatModelId } from './models';
import type { WeatherPayload } from './weather';

export type { ChatModelId } from './models';
export type ChatRole = 'user' | 'assistant';

export type ToolActivityKind =
  | 'list'
  | 'read'
  | 'create'
  | 'edit'
  | 'delete'
  | 'build'
  | 'search'
  | 'fetch'
  | 'weather';

export type ToolActivityLink = {
  title: string;
  url: string;
  snippet?: string;
  /** прямая картинка из поиска */
  image?: string;
};

/** Карточка tool-шага в ответе (кодинг / web / погода) */
export type ToolActivity = {
  id: string;
  name: string;
  kind: ToolActivityKind;
  /** путь файла, URL или поисковый запрос */
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
  /** результаты web_search — для просмотра ресурсов */
  links?: ToolActivityLink[];
  /** структурированная погода для WeatherCard */
  weather?: WeatherPayload;
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
  /** техническая деталь ошибки (показывается только в debug) */
  errorDetail?: string | null;
  /**
   * Карточка нагрузки вместо точек:
   * intercept — ждём 5с / Owner
   * queue — ручной/админ режим, вернитесь позже
   */
  serverLoad?: 'intercept' | 'queue' | null;
  /** ответ от лица администрации (режим Админ) */
  asAdmin?: boolean;
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
  /** Веб-поиск / чтение сайтов (по умолчанию вкл) */
  webTools?: boolean;
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
                        kind: (
                          [
                            'list',
                            'read',
                            'create',
                            'edit',
                            'delete',
                            'build',
                            'search',
                            'fetch',
                            'weather',
                          ] as const
                        ).includes(t.kind as ToolActivityKind)
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
                        links: Array.isArray(t.links)
                          ? t.links
                              .filter((l) => l && typeof l === 'object' && typeof l.url === 'string')
                              .slice(0, 12)
                              .map((l) => ({
                                title: String(l.title || l.url).slice(0, 200),
                                url: String(l.url).slice(0, 500),
                                snippet:
                                  typeof l.snippet === 'string'
                                    ? l.snippet.slice(0, 400)
                                    : undefined,
                                image:
                                  typeof l.image === 'string' &&
                                  /^https?:\/\//i.test(l.image)
                                    ? l.image.slice(0, 2000)
                                    : undefined,
                              }))
                          : undefined,
                        weather:
                          t.weather &&
                          typeof t.weather === 'object' &&
                          t.weather.current &&
                          typeof t.weather.place === 'string'
                            ? (t.weather as WeatherPayload)
                            : undefined,
                      }))
                      .filter((t) => t.id && t.name)
                  : undefined,
                errorDetail:
                  typeof m.errorDetail === 'string' ? m.errorDetail.slice(0, 4000) : m.errorDetail ?? null,
                serverLoad:
                  m.serverLoad === 'intercept' || m.serverLoad === 'queue' ? m.serverLoad : null,
                asAdmin: Boolean(m.asAdmin),
                viaAdmin: Boolean(m.viaAdmin) || undefined,
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
          webTools: c.webTools !== false,
          draft: typeof c.draft === 'string' ? c.draft.slice(0, 2000) : '',
        }))
      : [],
    folders: Array.isArray(parsed.folders) ? parsed.folders : [],
    activeId: parsed.activeId ?? null,
    updatedAt: parsed.updatedAt,
  };
}

/** Слияние двух сторов: не теряем codingTools/reasoning при синке с облаком */
export function mergeChatStores(a: ChatStore, b: ChatStore): ChatStore {
  const byId = new Map<string, ChatThread>();
  for (const c of a.chats) byId.set(c.id, c);
  for (const c of b.chats) {
    const prev = byId.get(c.id);
    if (!prev) {
      byId.set(c.id, c);
      continue;
    }
    const cTs = c.updatedAt || 0;
    const pTs = prev.updatedAt || 0;
    const newer = cTs >= pTs ? c : prev;
    const older = newer === c ? prev : c;
    // при равном updatedAt не затираем включённые инструменты «пустой» копией
    const sameTs = cTs === pTs;
    byId.set(c.id, {
      ...newer,
      reasoning: sameTs ? Boolean(c.reasoning || prev.reasoning) : Boolean(newer.reasoning),
      codingTools: sameTs ? Boolean(c.codingTools || prev.codingTools) : Boolean(newer.codingTools),
      webTools: sameTs
        ? c.webTools !== false || prev.webTools !== false
        : newer.webTools !== false,
      draft: (newer.draft || older.draft || '').slice(0, 2000),
      adminSystemPrompt: newer.adminSystemPrompt ?? older.adminSystemPrompt ?? null,
    });
  }
  const aTs = a.updatedAt || 0;
  const bTs = b.updatedAt || 0;
  const preferActive = aTs >= bTs ? a : b;
  return {
    chats: [...byId.values()].sort((x, y) => (y.updatedAt || 0) - (x.updatedAt || 0)),
    folders: (preferActive.folders?.length ? preferActive.folders : a.folders?.length ? a.folders : b.folders) || [],
    activeId: preferActive.activeId ?? a.activeId ?? b.activeId ?? null,
    updatedAt: Math.max(aTs, bTs, Date.now()),
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
  /** заменить placeholder (heldAssistantId) вместо нового сообщения */
  replaceMessageId?: string | null;
  asAdmin?: boolean;
  toolActivity?: ToolActivity[];
  reasoning?: string | null;
}): Promise<ChatStore> {
  const current = (await fetchUserChatStore(params.uid)) ?? emptyChatStore();
  const now = Date.now();
  const thread = current.chats.find((c) => c.id === params.chatId);
  const msg: ChatMessage = {
    id: params.replaceMessageId || `ai-${now}-${Math.random().toString(36).slice(2, 7)}`,
    role: 'assistant',
    content: params.content.trim(),
    createdAt: now,
    viaAdmin: true,
    asAdmin: Boolean(params.asAdmin),
    modelId: thread ? normalizeModelId(thread.modelId) : null,
    thinkingPhase: null,
    serverLoad: null,
    toolActivity: params.toolActivity,
    reasoning: params.reasoning ?? null,
  };
  const chats = current.chats.map((c) => {
    if (c.id !== params.chatId) return c;
    const idx = params.replaceMessageId
      ? c.messages.findIndex((m) => m.id === params.replaceMessageId)
      : -1;
    const messages =
      idx >= 0
        ? c.messages.map((m, i) => (i === idx ? { ...m, ...msg } : m))
        : [...c.messages, msg];
    // убрать другие пустые load-плейсхолдеры
    const cleaned = messages.filter(
      (m) =>
        !(
          m.role === 'assistant' &&
          !m.content?.trim() &&
          m.serverLoad &&
          m.id !== msg.id
        ),
    );
    return { ...c, messages: cleaned, updatedAt: now };
  });
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
