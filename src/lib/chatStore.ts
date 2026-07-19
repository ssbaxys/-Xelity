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

/** Firebase RTDB: массивы часто приходят как `{0:…,1:…}` */
function asArray<T = unknown>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    return Object.keys(o)
      .sort((a, b) => Number(a) - Number(b) || a.localeCompare(b))
      .map((k) => o[k] as T);
  }
  return [];
}

/** Firebase set() падает на undefined — вычищаем рекурсивно */
export function stripUndefinedDeep<T>(value: T): T {
  if (value === undefined || value === null) return value;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => stripUndefinedDeep(item)) as T;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v === undefined) continue;
    out[k] = stripUndefinedDeep(v);
  }
  return out as T;
}

function compactToolActivity(raw: unknown): ToolActivity[] | undefined {
  const list = asArray<Record<string, unknown>>(raw)
    .filter((t) => t && typeof t === 'object')
    .map((t) => {
      const kindList = [
        'list',
        'read',
        'create',
        'edit',
        'delete',
        'build',
        'search',
        'fetch',
        'weather',
      ] as const;
      const kind = kindList.includes(t.kind as ToolActivityKind)
        ? (t.kind as ToolActivityKind)
        : ('edit' as ToolActivityKind);
      const item: ToolActivity = {
        id: String(t.id || ''),
        name: String(t.name || ''),
        kind,
        ok: Boolean(t.ok),
      };
      if (typeof t.path === 'string') item.path = t.path;
      if (typeof t.error === 'string') item.error = t.error;
      if (typeof t.startLine === 'number') item.startLine = t.startLine;
      if (typeof t.endLine === 'number') item.endLine = t.endLine;
      if (typeof t.before === 'string') item.before = t.before.slice(0, 80_000);
      if (typeof t.after === 'string') item.after = t.after.slice(0, 80_000);
      if (t.pending) item.pending = true;
      if (Array.isArray(t.links) || (t.links && typeof t.links === 'object')) {
        const links = asArray<Record<string, unknown>>(t.links)
          .filter((l) => l && typeof l === 'object' && typeof l.url === 'string')
          .slice(0, 12)
          .map((l) => {
            const link: ToolActivityLink = {
              title: String(l.title || l.url).slice(0, 200),
              url: String(l.url).slice(0, 500),
            };
            if (typeof l.snippet === 'string') link.snippet = l.snippet.slice(0, 400);
            if (typeof l.image === 'string' && /^https?:\/\//i.test(l.image)) {
              link.image = l.image.slice(0, 2000);
            }
            return link;
          });
        if (links.length) item.links = links;
      }
      if (
        t.weather &&
        typeof t.weather === 'object' &&
        (t.weather as WeatherPayload).current &&
        typeof (t.weather as WeatherPayload).place === 'string'
      ) {
        item.weather = t.weather as WeatherPayload;
      }
      return item;
    })
    .filter((t) => t.id && t.name);
  return list.length ? list : undefined;
}

export function normalizeChatStore(raw: unknown): ChatStore {
  if (!raw || typeof raw !== 'object') return emptyChatStore();
  const parsed = raw as Partial<ChatStore> & Record<string, unknown>;
  const chatsRaw = asArray<Partial<ChatThread>>(parsed.chats);
  const foldersRaw = asArray<ChatFolder>(parsed.folders);

  return {
    chats: chatsRaw
      .filter((c) => c && typeof c === 'object' && c.id)
      .map((c) => {
        const messages = asArray<Partial<ChatMessage>>(c.messages).map((m) => {
          const msg: ChatMessage = {
            id: String(m.id || ''),
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: typeof m.content === 'string' ? m.content : '',
            createdAt: typeof m.createdAt === 'number' ? m.createdAt : Date.now(),
          };
          if (m.modelId) msg.modelId = normalizeModelId(m.modelId);
          if (typeof m.reasoning === 'string') msg.reasoning = m.reasoning;
          if (typeof m.reasoningMs === 'number') msg.reasoningMs = m.reasoningMs;
          if (m.thinkingPhase === 'thinking' || m.thinkingPhase === 'answering') {
            msg.thinkingPhase = m.thinkingPhase;
          }
          if (m.usedReasoning) msg.usedReasoning = true;
          const tools = compactToolActivity(m.toolActivity);
          if (tools) msg.toolActivity = tools;
          if (typeof m.errorDetail === 'string') msg.errorDetail = m.errorDetail.slice(0, 4000);
          if (m.serverLoad === 'intercept' || m.serverLoad === 'queue') {
            msg.serverLoad = m.serverLoad;
          }
          if (m.asAdmin) msg.asAdmin = true;
          if (m.viaAdmin) msg.viaAdmin = true;
          return msg;
        });

        return {
          id: String(c.id),
          title: typeof c.title === 'string' ? c.title : 'Новый чат',
          messages,
          createdAt: typeof c.createdAt === 'number' ? c.createdAt : Date.now(),
          updatedAt: typeof c.updatedAt === 'number' ? c.updatedAt : Date.now(),
          manualTitle: Boolean(c.manualTitle),
          pinned: Boolean(c.pinned),
          folderId: c.folderId ?? null,
          modelId: normalizeModelId(c.modelId),
          adminSystemPrompt:
            typeof c.adminSystemPrompt === 'string' ? c.adminSystemPrompt : null,
          reasoning: Boolean(c.reasoning),
          codingTools: Boolean(c.codingTools),
          webTools: c.webTools !== false,
          draft: typeof c.draft === 'string' ? c.draft.slice(0, 2000) : '',
        } satisfies ChatThread;
      }),
    folders: foldersRaw.filter((f) => f && typeof f === 'object' && f.id),
    activeId: typeof parsed.activeId === 'string' ? parsed.activeId : null,
    updatedAt: typeof parsed.updatedAt === 'number' ? parsed.updatedAt : undefined,
  };
}

/** Слияние двух сторов: чаты по id не теряем; папки — у более нового стора */
export function mergeChatStores(a: ChatStore, b: ChatStore): ChatStore {
  const aTs = a.updatedAt || 0;
  const bTs = b.updatedAt || 0;
  const newerStore = aTs >= bTs ? a : b;
  const olderStore = newerStore === a ? b : a;
  const skewMs = 15_000;

  const byId = new Map<string, ChatThread>();
  for (const c of newerStore.chats) {
    if (c?.id) byId.set(c.id, c);
  }
  for (const c of olderStore.chats) {
    if (!c?.id) continue;
    const prev = byId.get(c.id);
    if (!prev) {
      // чат только в старом: оставляем при близких updatedAt (параллельное создание)
      // или если новый стор не новее надолго (иначе это удаление)
      if (Math.abs(aTs - bTs) <= skewMs) byId.set(c.id, c);
      continue;
    }
    const cTs = c.updatedAt || 0;
    const pTs = prev.updatedAt || 0;
    const newer = cTs >= pTs ? c : prev;
    const older = newer === c ? prev : c;
    const sameTs = cTs === pTs;
    // сообщения: берём более длинную/новую ленту
    const messages =
      (newer.messages?.length || 0) >= (older.messages?.length || 0)
        ? newer.messages
        : older.messages;
    byId.set(c.id, {
      ...newer,
      messages,
      reasoning: sameTs ? Boolean(c.reasoning || prev.reasoning) : Boolean(newer.reasoning),
      codingTools: sameTs ? Boolean(c.codingTools || prev.codingTools) : Boolean(newer.codingTools),
      webTools: sameTs
        ? c.webTools !== false || prev.webTools !== false
        : newer.webTools !== false,
      draft: (newer.draft || older.draft || '').slice(0, 2000),
      adminSystemPrompt: newer.adminSystemPrompt ?? older.adminSystemPrompt ?? null,
    });
  }

  const folders = Array.isArray(newerStore.folders) ? newerStore.folders : [];
  return {
    chats: [...byId.values()].sort((x, y) => (y.updatedAt || 0) - (x.updatedAt || 0)),
    folders,
    activeId: newerStore.activeId ?? olderStore.activeId ?? null,
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
  // Firebase RTDB запрещает undefined в любом свойстве (часто toolActivity)
  const payload = stripUndefinedDeep({
    ...store,
    updatedAt: Date.now(),
  });
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

/** Убрать пустые плейсхолдеры intercept/queue из чата */
export async function adminClearServerLoadPlaceholders(
  uid: string,
  chatId: string,
): Promise<ChatStore> {
  const current = (await fetchUserChatStore(uid)) ?? emptyChatStore();
  const now = Date.now();
  const chats = current.chats.map((c) => {
    if (c.id !== chatId) return c;
    const messages = c.messages.filter(
      (m) =>
        !(
          m.role === 'assistant' &&
          !m.content?.trim() &&
          (m.serverLoad === 'queue' || m.serverLoad === 'intercept')
        ),
    );
    if (messages.length === c.messages.length) return c;
    return { ...c, messages, updatedAt: now };
  });
  const next: ChatStore = { ...current, chats, updatedAt: now };
  await saveUserChatStore(uid, next);
  return next;
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

export async function adminEditMessage(params: {
  uid: string;
  chatId: string;
  messageId: string;
  content: string;
}): Promise<ChatStore> {
  const current = (await fetchUserChatStore(params.uid)) ?? emptyChatStore();
  const text = params.content.trim();
  if (!text) throw new Error('Пустое сообщение');
  let found = false;
  const now = Date.now();
  const chats = current.chats.map((c) => {
    if (c.id !== params.chatId) return c;
    const messages = c.messages.map((m) => {
      if (m.id !== params.messageId) return m;
      found = true;
      return {
        ...m,
        content: text,
        serverLoad: null,
        viaAdmin: true,
      };
    });
    return { ...c, messages, updatedAt: now };
  });
  if (!found) throw new Error('Сообщение не найдено');
  const next: ChatStore = { ...current, chats, updatedAt: now };
  await saveUserChatStore(params.uid, next);
  return next;
}

export async function adminDeleteMessage(params: {
  uid: string;
  chatId: string;
  messageId: string;
}): Promise<ChatStore> {
  const current = (await fetchUserChatStore(params.uid)) ?? emptyChatStore();
  let found = false;
  const now = Date.now();
  const chats = current.chats.map((c) => {
    if (c.id !== params.chatId) return c;
    const before = c.messages.length;
    const messages = c.messages.filter((m) => m.id !== params.messageId);
    if (messages.length !== before) found = true;
    return { ...c, messages, updatedAt: now };
  });
  if (!found) throw new Error('Сообщение не найдено');
  const next: ChatStore = { ...current, chats, updatedAt: now };
  await saveUserChatStore(params.uid, next);
  return next;
}
