import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuth } from '../context/AuthContext';
import { usePrefs, type AppLanguage, type AppTheme, type UiScale } from '../context/PrefsContext';
import { getPlan } from '../lib/plans';
import LimitsModal from './LimitsModal';
import {
  loadLocalChatStore,
  saveLocalChatStore,
  saveUserChatStore,
  fetchUserChatStore,
  type ChatFolder,
  type ChatMessage,
  type ChatModelId,
  type ChatStore,
  type ChatThread,
} from '../lib/chatStore';
import {
  generateAssistantInBackground,
  isChatGenerating,
  subscribeChatStoreUpdates,
} from '../lib/chatGeneration';
import {
  MODELS,
  creditCostForRequest,
  DEFAULT_MODEL_ID,
} from '../lib/models';
import {
  canSendMessage,
  readGuestUsage,
  writeChatMeta,
} from '../lib/rtdb';
import AuthModal, { type AuthMode } from './AuthModal';
import BroadcastBanner from './BroadcastBanner';
import AssistantReply from './AssistantReply';
import {
  IconAdmin,
  IconBrain,
  IconChat,
  IconCheck,
  IconEmpty,
  IconChevronDown,
  IconChevronRight,
  IconClose,
  IconCopy,
  IconDuplicate,
  IconExport,
  IconFolder,
  IconFolderOut,
  IconGrip,
  IconLimits,
  IconLogout,
  IconMenu,
  IconMore,
  IconPencil,
  IconPin,
  IconPricing,
  IconSearch,
  IconSend,
  IconSettings,
  IconSupport,
  IconTrash,
  IconUser,
} from './icons';

const MAX_CHARS = 2000;
const ACCENT = '#c62828';

/** abc***xyz@gmail.com — первые 3 и последние 3 символа до @, остальное *** */
function maskEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  const at = normalized.indexOf('@');
  if (at <= 0) return '***';
  const local = normalized.slice(0, at);
  const domain = normalized.slice(at + 1);
  if (!domain) return '***';
  const start = local.slice(0, 3);
  const end = local.slice(-3);
  return `${start}***${end}@${domain}`;
}

function userDisplayName(user: { displayName: string | null; email: string | null }): string {
  const name = user.displayName?.trim();
  if (name) return name;
  const email = user.email?.trim();
  if (email) return email.split('@')[0] || 'Пользователь';
  return 'Пользователь';
}

type SortMode = 'updated' | 'alpha';
type ModelId = ChatModelId;
type Store = ChatStore;

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function loadStore(): Store {
  return loadLocalChatStore();
}

const STOP_WORDS = new Set([
  'и',
  'в',
  'во',
  'на',
  'по',
  'с',
  'со',
  'к',
  'ко',
  'у',
  'о',
  'об',
  'от',
  'до',
  'за',
  'из',
  'для',
  'при',
  'про',
  'а',
  'но',
  'или',
  'как',
  'что',
  'это',
  'этот',
  'эта',
  'эти',
  'мне',
  'меня',
  'мой',
  'моя',
  'мои',
  'пожалуйста',
  'привет',
  'здравствуйте',
  'помоги',
  'помогите',
  'сделай',
  'сделайте',
  'напиши',
  'напишите',
  'расскажи',
  'объясни',
  'скажи',
  'можно',
  'нужно',
  'хочу',
  'хотел',
  'хотела',
  'бы',
  'ли',
  'же',
  'то',
  'не',
  'да',
  'нет',
  'the',
  'a',
  'an',
  'to',
  'of',
  'and',
  'or',
  'in',
  'on',
  'for',
  'with',
  'please',
  'help',
  'me',
  'my',
  'i',
  'you',
  'can',
  'could',
  'would',
  'write',
  'make',
  'create',
  'explain',
]);

/** ИИ-название чата по первому сообщению */
function inventChatTitle(raw: string, modelId: ModelId): string {
  let text = raw
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]+`/g, ' ')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/[#>*_~\[\](){}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) {
    const fallback = MODELS.find((m) => m.id === modelId)?.name ?? 'Новый чат';
    return fallback;
  }

  // Берём первое предложение / строку
  const firstChunk = text.split(/[.!?\n]/)[0]?.trim() || text;

  const words = firstChunk
    .split(/\s+/)
    .map((w) => w.replace(/^[^0-9A-Za-zА-Яа-яЁё]+|[^0-9A-Za-zА-Яа-яЁё]+$/g, ''))
    .filter(Boolean);

  const meaningful = words.filter((w) => !STOP_WORDS.has(w.toLowerCase()));
  const picked = (meaningful.length >= 2 ? meaningful : words).slice(0, 6);

  let title = picked.join(' ').trim();
  if (!title) title = firstChunk.slice(0, 42).trim();

  // Капитализация первой буквы
  title = title.charAt(0).toUpperCase() + title.slice(1);

  if (title.length > 48) {
    title = `${title.slice(0, 45).trim()}…`;
  }

  if (modelId === 'xlaude-pro-k2' && !/pro|k2|архит|стратег|спец/i.test(title)) {
    if (picked.length <= 4) title = `Pro: ${title}`;
  } else if (modelId === 'xlaude-pro-k1' && !/про|задач|план|отчёт|документ/i.test(title)) {
    if (picked.length <= 4) title = `Рабочий: ${title}`;
  } else if (modelId === 'xlaude-mini-k2' && !/k2|разбор|анализ|обзор/i.test(title)) {
    if (picked.length <= 4) title = `Разбор: ${title}`;
  }

  return title || 'Новый чат';
}

function isDefaultTitle(title: string) {
  return title === 'Новый чат' || /^Чат\s+\d+$/i.test(title);
}

function shouldAutoName(chat: ChatThread) {
  return !chat.manualTitle && isDefaultTitle(chat.title);
}

function makeChat(
  _chats: ChatThread[],
  modelId: ModelId = DEFAULT_MODEL_ID,
  folderId: string | null = null,
): ChatThread {
  const now = Date.now();
  return {
    id: uid('chat'),
    title: 'Новый чат',
    messages: [],
    createdAt: now,
    updatedAt: now,
    pinned: false,
    folderId,
    modelId,
    manualTitle: false,
    reasoning: false,
    draft: '',
  };
}

/** Новая Папка → Новая Папка(1) → Новая Папка(2) … */
function nextFolderTitle(existing: ChatFolder[]): string {
  const base = 'Новая Папка';
  const taken = new Set(existing.map((f) => f.title));
  if (!taken.has(base)) return base;
  let n = 1;
  while (taken.has(`${base}(${n})`)) n += 1;
  return `${base}(${n})`;
}

function MarkdownBody({ content }: { content: string }) {
  return (
    <div className="chat-md min-w-0 max-w-full overflow-x-auto text-[15px] leading-[1.65] text-[var(--c-text)]">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

type Props = {
  homeSlot?: ReactNode;
};

export default function ChatWorkspace({ homeSlot }: Props) {
  const { user, profile, loading: authLoading, logout, planId, planExpiresAt, isStaff, staffRole, isBanned } = useAuth();
  const plan = getPlan(planId);
  const banned = isBanned;
  const muted = Boolean(profile?.muted);
  const adminWarning = (profile?.adminWarning || '').trim();
  const {
    language,
    theme,
    uiScale,
    setLanguage,
    setTheme,
    setUiScale,
    t,
  } = usePrefs();
  const [store, setStore] = useState<Store>(() => loadStore());
  const [draft, setDraft] = useState('');
  const draftRef = useRef('');
  draftRef.current = draft;
  const activeIdRef = useRef<string | null>(null);
  const [sending, setSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : true,
  );
  const [search, setSearch] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('updated');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [menuId, setMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number; openUp: boolean } | null>(
    null,
  );
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [foldAnim, setFoldAnim] = useState<{ from: string; into: string } | null>(null);
  const [modelOpen, setModelOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [limitsOpen, setLimitsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [limitHint, setLimitHint] = useState<string | null>(null);
  const [usageToday, setUsageToday] = useState(0);
  const endRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatMenuRef = useRef<HTMLDivElement>(null);
  const userRef = useRef(user);
  userRef.current = user;

  const closeChatMenu = useCallback(() => {
    setMenuId(null);
    setMenuPos(null);
  }, []);

  const openChatMenu = useCallback((chatId: string, anchor: HTMLElement) => {
    const rect = anchor.getBoundingClientRect();
    const menuW = 176;
    const menuH = 220;
    const openUp = rect.bottom + menuH > window.innerHeight - 8;
    const left = Math.max(8, Math.min(rect.right - menuW, window.innerWidth - menuW - 8));
    const top = openUp ? rect.top - 4 : rect.bottom + 4;
    setMenuId(chatId);
    setMenuPos({ top, left, openUp });
  }, []);

  const { chats, folders, activeId } = store;

  const persist = useCallback(
    (next: Store) => {
      setStore(next);
      saveLocalChatStore(next);
      if (user) {
        void saveUserChatStore(user.uid, next).catch(() => {
          /* offline / rules — локальная копия уже сохранена */
        });
      }
    },
    [user],
  );

  /** Записать черновик в конкретный чат (без смены activeId) */
  const saveDraftToChat = useCallback(
    (chatId: string | null | undefined, text: string) => {
      if (!chatId) return;
      const clipped = text.slice(0, MAX_CHARS);
      setStore((prev) => {
        const cur = prev.chats.find((c) => c.id === chatId);
        if (!cur || (cur.draft || '') === clipped) return prev;
        const next = {
          ...prev,
          chats: prev.chats.map((c) => (c.id === chatId ? { ...c, draft: clipped } : c)),
        };
        saveLocalChatStore(next);
        const u = userRef.current;
        if (u) void saveUserChatStore(u.uid, next).catch(() => {});
        return next;
      });
    },
    [],
  );

  /** Переключить чат, сохранив черновик текущего */
  const selectChat = useCallback((nextId: string) => {
    const prevId = activeIdRef.current;
    setStore((prev) => {
      const withDraft =
        prevId && prevId !== nextId
          ? {
              ...prev,
              chats: prev.chats.map((c) =>
                c.id === prevId ? { ...c, draft: draftRef.current.slice(0, MAX_CHARS) } : c,
              ),
              activeId: nextId,
            }
          : { ...prev, activeId: nextId };
      saveLocalChatStore(withDraft);
      const u = userRef.current;
      if (u) void saveUserChatStore(u.uid, withDraft).catch(() => {});
      return withDraft;
    });
    if (!window.matchMedia('(min-width: 1024px)').matches) setSidebarOpen(false);
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      try {
        const remote = await fetchUserChatStore(user.uid);
        const local = loadLocalChatStore();
        if (cancelled) return;
        if (!remote) {
          if (local.chats.length) {
            await saveUserChatStore(user.uid, local);
          }
          return;
        }
        const remoteTs = remote.updatedAt || 0;
        const localTs = local.updatedAt || 0;
        const prefer =
          remote.chats.length >= local.chats.length || remoteTs >= localTs ? remote : local;
        setStore(prefer);
        saveLocalChatStore(prefer);
        if (prefer === local && local.chats.length) {
          await saveUserChatStore(user.uid, local);
        }
      } catch {
        /* keep local */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  const active = useMemo(
    () => (activeId ? chats.find((c) => c.id === activeId) ?? null : null),
    [chats, activeId],
  );

  // Подгрузить черновик активного чата при смене чата
  useEffect(() => {
    activeIdRef.current = activeId;
    const nextDraft = (active?.draft || '').slice(0, MAX_CHARS);
    setDraft(nextDraft);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
    });
    // только при смене чата — не при каждом обновлении store
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sync draft on chat switch
  }, [activeId]);

  // Автосохранение черновика (debounce)
  useEffect(() => {
    if (!activeId) return;
    const t = window.setTimeout(() => {
      saveDraftToChat(activeId, draft);
    }, 350);
    return () => window.clearTimeout(t);
  }, [draft, activeId, saveDraftToChat]);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const sync = () => setSidebarOpen(mq.matches);
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [active?.messages.length, sending, activeId]);

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      if (user) {
        const { used } = await canSendMessage(user.uid, planId, 1);
        if (!cancelled) setUsageToday(used);
      } else {
        setUsageToday(readGuestUsage().credits);
      }
    };
    void refresh();
    return () => {
      cancelled = true;
    };
  }, [user, planId, sending]);

  useEffect(() => {
    if (!user) return;
    const sync = () => {
      const messageCount = chats.reduce((n, c) => n + c.messages.length, 0);
      void writeChatMeta({
        uid: user.uid,
        email: user.email || undefined,
        threadCount: chats.length,
        messageCount,
        lastActive: Date.now(),
      });
    };
    sync();
    const t = window.setInterval(sync, 60_000);
    return () => window.clearInterval(t);
  }, [user, chats]);

  useEffect(() => {
    const close = () => {
      setModelOpen(false);
      setProfileOpen(false);
    };
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  useEffect(() => {
    if (!menuId) return;
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (chatMenuRef.current?.contains(target)) return;
      if ((target as Element).closest?.(`[data-chat-menu-btn="${menuId}"]`)) return;
      closeChatMenu();
    };
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') closeChatMenu();
    };
    const onReposition = () => closeChatMenu();
    window.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      window.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [menuId, closeChatMenu]);

  useEffect(() => {
    if (!settingsOpen) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setSettingsOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [settingsOpen]);

  const matchesSearch = useCallback(
    (chat: ChatThread) => {
      const q = search.trim().toLowerCase();
      if (!q) return true;
      if (chat.title.toLowerCase().includes(q)) return true;
      return chat.messages.some((m) => m.content.toLowerCase().includes(q));
    },
    [search],
  );

  const sortChats = useCallback(
    (list: ChatThread[]) =>
      [...list].sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        if (sortMode === 'alpha') return a.title.localeCompare(b.title, language === 'en' ? 'en' : 'ru');
        return b.updatedAt - a.updatedAt;
      }),
    [sortMode, language],
  );

  const rootChats = useMemo(
    () => sortChats(chats.filter((c) => !c.folderId && matchesSearch(c))),
    [chats, matchesSearch, sortChats],
  );

  const chatsInFolder = useCallback(
    (folderId: string) => sortChats(chats.filter((c) => c.folderId === folderId && matchesSearch(c))),
    [chats, matchesSearch, sortChats],
  );

  const visibleFolders = useMemo(() => {
    if (!search.trim()) return folders;
    return folders.filter(
      (f) =>
        chatsInFolder(f.id).length > 0 || f.title.toLowerCase().includes(search.toLowerCase()),
    );
  }, [folders, chatsInFolder, search]);

  const startRename = (id: string, current: string) => {
    setRenamingId(id);
    setRenameValue(current);
    closeChatMenu();
  };

  const commitRename = () => {
    if (!renamingId) return;
    const title = renameValue.trim() || 'Новый чат';
    const isFolder = folders.some((f) => f.id === renamingId);
    persist(
      isFolder
        ? { ...store, folders: folders.map((f) => (f.id === renamingId ? { ...f, title } : f)) }
        : {
            ...store,
            chats: chats.map((c) =>
              c.id === renamingId
                ? { ...c, title, manualTitle: true, updatedAt: Date.now() }
                : c,
            ),
          },
    );
    setRenamingId(null);
  };

  const createChat = (folderId: string | null = null) => {
    const prevId = activeIdRef.current;
    const savedDraft = draftRef.current.slice(0, MAX_CHARS);
    const chat = makeChat(chats, active?.modelId ?? DEFAULT_MODEL_ID, folderId);
    const chatsWithPrevDraft = prevId
      ? chats.map((c) => (c.id === prevId ? { ...c, draft: savedDraft } : c))
      : chats;
    persist({
      ...store,
      chats: [chat, ...chatsWithPrevDraft],
      activeId: chat.id,
    });
    setDraft('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    const desktop = window.matchMedia('(min-width: 1024px)').matches;
    setSidebarOpen(desktop);
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const deleteChat = (id: string) => {
    const nextChats = chats.filter((c) => c.id !== id);
    persist({
      ...store,
      chats: nextChats,
      activeId: activeId === id ? nextChats[0]?.id ?? null : activeId,
    });
  };

  const deleteFolder = (id: string) => {
    persist({
      ...store,
      folders: folders.filter((f) => f.id !== id),
      chats: chats.map((c) => (c.folderId === id ? { ...c, folderId: null } : c)),
    });
  };

  const togglePin = (id: string) => {
    persist({
      ...store,
      chats: chats.map((c) =>
        c.id === id ? { ...c, pinned: !c.pinned, updatedAt: Date.now() } : c,
      ),
    });
  };

  const duplicateChat = (id: string) => {
    const src = chats.find((c) => c.id === id);
    if (!src) return;
    const copy: ChatThread = {
      ...src,
      id: uid('chat'),
      title: src.title,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      pinned: false,
      manualTitle: src.manualTitle,
    };
    persist({ ...store, chats: [copy, ...chats], activeId: copy.id });
  };

  const exportChat = (id: string) => {
    const chat = chats.find((c) => c.id === id);
    if (!chat) return;
    const text = chat.messages
      .map((m) => `[${m.role === 'user' ? 'Вы' : 'Xlaude'}]\n${m.content}`)
      .join('\n\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${chat.title}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const setModel = (modelId: ModelId) => {
    if (!active) return;
    persist({
      ...store,
      chats: chats.map((c) =>
        c.id === active.id ? { ...c, modelId, updatedAt: Date.now() } : c,
      ),
    });
    setModelOpen(false);
  };

  const setReasoning = (on: boolean) => {
    if (!active) return;
    persist({
      ...store,
      chats: chats.map((c) =>
        c.id === active.id ? { ...c, reasoning: on, updatedAt: Date.now() } : c,
      ),
    });
  };

  const onDragStart = (e: DragEvent, id: string) => {
    setDragId(id);
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const onDragOver = (e: DragEvent, targetKey: string) => {
    e.preventDefault();
    setDropTarget(targetKey);
  };

  const onDropOnChat = (e: DragEvent, targetChatId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const sourceId = e.dataTransfer.getData('text/plain') || dragId;
    setDragId(null);
    setDropTarget(null);
    if (!sourceId || sourceId === targetChatId || foldAnim) return;

    const source = chats.find((c) => c.id === sourceId);
    const target = chats.find((c) => c.id === targetChatId);
    if (!source || !target) return;

    setFoldAnim({ from: sourceId, into: targetChatId });

    window.setTimeout(() => {
      if (target.folderId && source.folderId !== target.folderId) {
        setStore((prev) => {
          const next = {
            ...prev,
            chats: prev.chats.map((c) =>
              c.id === sourceId
                ? { ...c, folderId: target.folderId, updatedAt: Date.now() }
                : c,
            ),
          };
          saveLocalChatStore(next);
          const u = userRef.current;
          if (u) void saveUserChatStore(u.uid, next).catch(() => {});
          return next;
        });
        setFoldAnim(null);
        return;
      }

      let createdFolderId = '';
      let createdFolderTitle = '';
      setStore((prev) => {
        const folder: ChatFolder = {
          id: uid('folder'),
          title: nextFolderTitle(prev.folders),
          createdAt: Date.now(),
          expanded: true,
        };
        createdFolderId = folder.id;
        createdFolderTitle = folder.title;
        const next = {
          ...prev,
          folders: [folder, ...prev.folders],
          chats: prev.chats.map((c) =>
            c.id === sourceId || c.id === targetChatId
              ? { ...c, folderId: folder.id, updatedAt: Date.now() }
              : c,
          ),
        };
        saveLocalChatStore(next);
        const u = userRef.current;
        if (u) void saveUserChatStore(u.uid, next).catch(() => {});
        return next;
      });
      setFoldAnim(null);
      if (createdFolderId) startRename(createdFolderId, createdFolderTitle);
    }, 420);
  };

  const onDropOnFolder = (e: DragEvent, folderId: string) => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain') || dragId;
    setDragId(null);
    setDropTarget(null);
    if (!sourceId) return;
    persist({
      ...store,
      chats: chats.map((c) =>
        c.id === sourceId ? { ...c, folderId, updatedAt: Date.now() } : c,
      ),
    });
  };

  const removeFromFolder = (id: string) => {
    persist({
      ...store,
      chats: chats.map((c) => (c.id === id ? { ...c, folderId: null, updatedAt: Date.now() } : c)),
    });
  };

  useEffect(() => {
    const sync = () => {
      setStore(loadLocalChatStore());
      setSending(isChatGenerating(activeId));
    };
    sync();
    return subscribeChatStoreUpdates(sync);
  }, [activeId]);

  useEffect(() => {
    setSending(isChatGenerating(active?.id));
  }, [active?.id, store.chats]);

  const sendMessage = async () => {
    const text = draft.trim();
    if (!text || sending || !active || text.length > MAX_CHARS) return;
    if (banned) {
      setLimitHint('Аккаунт заблокирован. Обратитесь в поддержку.');
      return;
    }
    if (muted) {
      setLimitHint('Отправка сообщений временно ограничена модерацией.');
      return;
    }
    if (isChatGenerating(active.id)) return;

    const creditCost = creditCostForRequest(active.modelId, active.reasoning);
    const gate = await canSendMessage(user?.uid ?? null, planId, creditCost);
    if (!gate.ok) {
      setLimitHint(
        gate.limit == null
          ? 'Кредиты на сегодня закончились.'
          : `Не хватает кредитов: нужно ${creditCost}, осталось ${Math.max(0, gate.limit - gate.used)} из ${gate.limit}. Обновите тариф или подождите до завтра.`,
      );
      return;
    }
    setLimitHint(null);

    const userMsg: ChatMessage = {
      id: uid('user'),
      role: 'user',
      content: text,
      createdAt: Date.now(),
      usedReasoning: Boolean(active.reasoning),
    };

    const nameNow = shouldAutoName(active);
    const invented = nameNow ? inventChatTitle(text, active.modelId) : active.title;
    const historyForApi = [...active.messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));
    const chatId = active.id;
    const modelId = active.modelId;

    persist({
      ...store,
      chats: chats.map((c) =>
        c.id === chatId
          ? {
              ...c,
              title: invented,
              messages: [...c.messages, userMsg],
              updatedAt: Date.now(),
              draft: '',
            }
          : c,
      ),
    });
    setDraft('');
    setSending(true);
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    // Не ждём в React: генерация допишет ответ в storage даже после ухода со страницы
    void generateAssistantInBackground({
      chatId,
      modelId,
      messages: historyForApi,
      maxTokens: plan.maxTokens,
      titleIfNotManual: invented,
      firebaseUid: user?.uid ?? null,
      promptText: text,
      systemExtra: active.adminSystemPrompt,
      reasoning: Boolean(active.reasoning),
    }).finally(() => {
      setSending(isChatGenerating(chatId));
      if (user) {
        void canSendMessage(user.uid, planId, 1).then((g) => setUsageToday(g.used));
      } else {
        setUsageToday(readGuestUsage().credits);
      }
    });
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void sendMessage();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  const onDraftChange = (value: string) => {
    setDraft(value.slice(0, MAX_CHARS));
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
    }
  };

  const renderChatRow = (chat: ChatThread, nested = false) => {
    const last = chat.messages[chat.messages.length - 1];
    const isActive = chat.id === active?.id;
    const isDrop = dropTarget === `chat:${chat.id}` && dragId !== chat.id;
    const isFoldingAway = foldAnim?.from === chat.id;
    const isFoldingInto = foldAnim?.into === chat.id;
    const renaming = renamingId === chat.id;

    return (
      <div
        key={chat.id}
        onDragOver={(e) => {
          if (dragId && dragId !== chat.id) onDragOver(e, `chat:${chat.id}`);
        }}
        onDragLeave={() => setDropTarget(null)}
        onDrop={(e) => onDropOnChat(e, chat.id)}
        className={`group relative ${nested ? 'pl-2' : ''} anim-slide-left ${
          isFoldingAway ? 'chat-fold-away' : ''
        } ${isFoldingInto ? 'chat-fold-into' : ''}`}
      >
        <div
          draggable={!renaming}
          onDragStart={(e) => {
            const el = e.target as HTMLElement;
            if (el.closest('[data-chat-menu-btn]') || el.closest('input')) {
              e.preventDefault();
              return;
            }
            onDragStart(e, chat.id);
          }}
          onDragEnd={() => {
            setDragId(null);
            setDropTarget(null);
          }}
          className={`chat-card relative flex items-center rounded-lg transition ${
            isActive ? 'bg-[var(--c-soft)]' : 'hover:bg-[var(--c-hover)]'
          } ${isDrop ? 'chat-drop-target' : ''} ${dragId === chat.id ? 'opacity-45' : ''} ${
            renaming ? '' : 'cursor-grab active:cursor-grabbing'
          }`}
          title={renaming ? undefined : 'Перетащите на другой чат, чтобы сложить в папку'}
        >
          {isDrop && (
            <div className="chat-fold-hint pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-[#c62828]/10">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-[var(--c-soft)]/95 px-2 py-1 text-[11px] text-[var(--c-text)] ring-1 ring-[#c62828]/40">
                <IconFolder className="h-3.5 w-3.5 text-[#c62828]" />
                В папку
              </span>
            </div>
          )}

          <span
            className="chat-grip flex h-10 w-7 shrink-0 items-center justify-center text-[var(--c-faint)]"
            aria-hidden
          >
            <IconGrip className="h-3.5 w-3.5" />
          </span>

          <button
            type="button"
            onClick={() => selectChat(chat.id)}
            onDoubleClick={() => startRename(chat.id, chat.title)}
            className="flex min-w-0 flex-1 cursor-inherit items-center gap-2 py-2 pr-1 text-left"
          >
            <div className="min-w-0 flex-1">
              {renaming ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={commitRename}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setRenamingId(null);
                  }}
                  className="w-full rounded bg-[var(--c-input)] px-1.5 py-0.5 text-[13px] text-[var(--c-text)] outline-none ring-1 ring-[var(--c-border-strong)]"
                />
              ) : (
                <p className="flex items-center gap-1.5 truncate text-[13px] text-[var(--c-text)]">
                  {chat.pinned && <IconPin className="h-2.5 w-2.5 shrink-0 text-[var(--c-muted)]" />}
                  {chat.title}
                </p>
              )}
              <p className="truncate text-[11px] text-[var(--c-faint)]">
                {last ? last.content.replace(/\n/g, ' ').slice(0, 40) : 'Пусто'}
              </p>
            </div>
          </button>
          <button
            type="button"
            data-chat-menu-btn={chat.id}
            onClick={(e) => {
              e.stopPropagation();
              if (menuId === chat.id) closeChatMenu();
              else openChatMenu(chat.id, e.currentTarget);
            }}
            className={`mr-1 rounded p-1 text-[var(--c-faint)] transition hover:bg-[var(--c-hover)] hover:text-[var(--c-text)] ${
              menuId === chat.id ? 'opacity-100 bg-[var(--c-hover)] text-[var(--c-text)]' : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100'
            }`}
            aria-label="Меню"
            aria-expanded={menuId === chat.id}
          >
            <IconMore className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  };

  const menuChat = menuId ? chats.find((c) => c.id === menuId) ?? null : null;

  const chatMenuItems = menuChat
    ? ([
        {
          label: 'Переименовать',
          icon: <IconPencil />,
          action: () => startRename(menuChat.id, menuChat.title),
        },
        {
          label: menuChat.pinned ? 'Открепить' : 'Закрепить',
          icon: <IconPin className="h-3.5 w-3.5" />,
          action: () => togglePin(menuChat.id),
        },
        {
          label: 'Дублировать',
          icon: <IconDuplicate />,
          action: () => duplicateChat(menuChat.id),
        },
        {
          label: 'Экспорт',
          icon: <IconExport />,
          action: () => exportChat(menuChat.id),
        },
        ...(menuChat.folderId
          ? [
              {
                label: 'Из папки',
                icon: <IconFolderOut />,
                action: () => removeFromFolder(menuChat.id),
              },
            ]
          : []),
        {
          label: 'Удалить',
          icon: <IconTrash />,
          action: () => deleteChat(menuChat.id),
          danger: true,
        },
      ] as Array<{
        label: string;
        icon: ReactNode;
        action: () => void;
        danger?: boolean;
      }>)
    : [];

  return (
    <div className="chat-app flex h-full min-h-0 w-full overflow-hidden bg-[var(--c-bg)] text-[var(--c-text)]">
      <BroadcastBanner uid={user?.uid ?? null} />
      {/* Sidebar */}
      <aside
        className={`absolute inset-y-0 left-0 z-30 flex w-[272px] flex-col border-r border-[var(--c-border)] bg-[var(--c-side)] transition-transform lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex shrink-0 items-center px-3 pt-3 pb-2">
          {homeSlot ?? <span />}
        </div>

        <div className="shrink-0 px-3 pb-3">
          <button
            type="button"
            onClick={() => createChat(null)}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-lg text-[13px] font-medium text-white transition hover:brightness-110"
            style={{ background: ACCENT }}
          >
            <IconChat className="h-3.5 w-3.5" />
            <span>{t('chat.new')}</span>
          </button>
        </div>

        <div className="shrink-0 px-3 pb-2">
          <div className="relative">
            <IconSearch className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[var(--c-faint)]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('chat.search')}
              className="h-8 w-full rounded-lg border border-transparent bg-[var(--c-input)] pr-2.5 pl-8 text-[12px] text-[var(--c-text)] outline-none placeholder:text-[var(--c-faint)] focus:border-[var(--c-border-strong)]"
            />
          </div>
          <div className="mt-2 flex items-center gap-1">
            {(
              [
                { id: 'updated' as const, label: t('chat.sort.updated') },
                { id: 'alpha' as const, label: t('chat.sort.alpha') },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSortMode(opt.id)}
                className={`rounded-md px-2 py-1 text-[10px] transition ${
                  sortMode === opt.id
                    ? 'bg-[var(--c-soft)] text-[var(--c-text)]'
                    : 'text-[var(--c-faint)] hover:text-[var(--c-muted)]'
                }`}
                title={t('chat.sort')}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
          {visibleFolders.map((folder) => {
            const inner = chatsInFolder(folder.id);
            const isDrop = dropTarget === `folder:${folder.id}`;
            const renaming = renamingId === folder.id;
            return (
              <div key={folder.id} className="mb-0.5">
                <div
                  onDragOver={(e) => onDragOver(e, `folder:${folder.id}`)}
                  onDragLeave={() => setDropTarget(null)}
                  onDrop={(e) => onDropOnFolder(e, folder.id)}
                  className={`flex items-center rounded-lg ${isDrop ? 'bg-[var(--c-soft)]' : ''}`}
                >
                  <button
                    type="button"
                    onClick={() =>
                      persist({
                        ...store,
                        folders: folders.map((f) =>
                          f.id === folder.id ? { ...f, expanded: !f.expanded } : f,
                        ),
                      })
                    }
                    onDoubleClick={() => startRename(folder.id, folder.title)}
                    className="flex min-w-0 flex-1 items-center gap-1.5 px-2 py-1.5 text-left text-[12px] text-[var(--c-muted)] hover:text-[var(--c-text)]"
                  >
                    {folder.expanded ? (
                      <IconChevronDown className="h-3 w-3 shrink-0" />
                    ) : (
                      <IconChevronRight className="h-3 w-3 shrink-0" />
                    )}
                    <IconFolder className="h-3.5 w-3.5 shrink-0" />
                    {renaming ? (
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={commitRename}
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => {
                          e.stopPropagation();
                          if (e.key === 'Enter') commitRename();
                          if (e.key === 'Escape') setRenamingId(null);
                        }}
                        className="w-full rounded bg-[var(--c-input)] px-1 text-[12px] outline-none ring-1 ring-[var(--c-border-strong)]"
                      />
                    ) : (
                      <span className="truncate">{folder.title}</span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => startRename(folder.id, folder.title)}
                    className="rounded p-1 text-[var(--c-faint)] hover:text-[var(--c-text)]"
                    aria-label="Переименовать"
                  >
                    <IconPencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteFolder(folder.id)}
                    className="rounded p-1 text-[var(--c-faint)] hover:text-[#e57373]"
                    aria-label="Удалить"
                  >
                    <IconClose className="h-3 w-3" />
                  </button>
                </div>
                {folder.expanded && inner.map((c) => renderChatRow(c, true))}
              </div>
            );
          })}

          {rootChats.map((c) => renderChatRow(c))}

          {!chats.length && !visibleFolders.length && (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
              <IconEmpty className="h-9 w-9 text-[var(--c-faint)]" />
              <p className="text-[12px] font-medium text-[var(--c-muted)]">
                {t('chat.empty.list')}
              </p>
              <p className="text-[11px] leading-snug text-[var(--c-faint)]">
                {t('chat.empty.list.hint')}
              </p>
            </div>
          )}

          {!!chats.length && !rootChats.length && !visibleFolders.length && (
            <p className="px-3 py-8 text-center text-[12px] text-[var(--c-faint)]">{t('chat.notfound')}</p>
          )}
        </div>

        <div className="relative shrink-0 border-t border-[var(--c-border)] p-2" onClick={(e) => e.stopPropagation()}>
          {authLoading ? (
            <div className="h-11 animate-pulse rounded-lg bg-[var(--c-hover)]" />
          ) : (
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setSettingsOpen(false);
                  setProfileOpen((v) => !v);
                }}
                className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition hover:bg-[var(--c-hover)] ${
                  profileOpen ? 'bg-[var(--c-hover)]' : ''
                }`}
              >
                {user?.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt=""
                    className="h-7 w-7 shrink-0 rounded-md object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--c-soft)] text-[11px] font-semibold text-[var(--c-muted)]">
                    {user ? userDisplayName(user).charAt(0).toUpperCase() : <IconUser className="h-3.5 w-3.5" />}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-medium text-[var(--c-text)]">
                    {user ? userDisplayName(user) : t('chat.guest')}
                  </span>
                  <span className="block truncate text-[10px] text-[var(--c-faint)]">
                    {user ? plan.name : t('chat.login.hint')}
                  </span>
                </span>
                <IconChevronDown
                  className={`h-3 w-3 shrink-0 text-[var(--c-faint)] transition ${profileOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {profileOpen && (
                <div className="anim-pop absolute bottom-full left-0 right-0 z-40 mb-2 overflow-hidden rounded-xl border border-[var(--c-border-strong)] bg-[var(--c-panel)] p-3 shadow-2xl">
                  {user ? (
                    <>
                      <div className="mb-2 flex items-center gap-2.5">
                        {user.photoURL ? (
                          <img
                            src={user.photoURL}
                            alt=""
                            className="h-9 w-9 shrink-0 rounded-lg object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--c-soft)] text-[var(--c-muted)]">
                            <IconUser className="h-4 w-4" />
                          </span>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-[var(--c-text)]">
                            {userDisplayName(user)}
                          </p>
                          <p className="mt-0.5 truncate font-mono text-[11px] tracking-tight text-[var(--c-muted)]">
                            {maskEmail(user.email || '')}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setProfileOpen(false);
                          setSettingsOpen(true);
                        }}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-[var(--c-muted)] transition hover:bg-[var(--c-hover)] hover:text-[var(--c-text)]"
                      >
                        <IconSettings className="h-3.5 w-3.5" />
                        {t('chat.settings')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setProfileOpen(false);
                          setLimitsOpen(true);
                        }}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-[var(--c-muted)] transition hover:bg-[var(--c-hover)] hover:text-[var(--c-text)]"
                      >
                        <IconLimits className="h-3.5 w-3.5" />
                        Лимиты
                      </button>
                      <Link
                        to="/pricing"
                        onClick={() => setProfileOpen(false)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-[var(--c-muted)] transition hover:bg-[var(--c-hover)] hover:text-[var(--c-text)]"
                      >
                        <IconPricing className="h-3.5 w-3.5" />
                        Тарифы
                      </Link>
                      <Link
                        to="/support"
                        onClick={() => setProfileOpen(false)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-[var(--c-muted)] transition hover:bg-[var(--c-hover)] hover:text-[var(--c-text)]"
                      >
                        <IconSupport className="h-3.5 w-3.5" />
                        Поддержка
                      </Link>
                      {isStaff && (
                        <Link
                          to="/admin"
                          onClick={() => setProfileOpen(false)}
                          className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-[#c62828] transition hover:bg-[var(--c-hover)]"
                        >
                          <IconAdmin className="h-3.5 w-3.5" />
                          {staffRole === 'helper'
                            ? 'Панель Helper'
                            : staffRole === 'moderator'
                              ? 'Панель Moderator'
                              : staffRole === 'owner'
                                ? 'Панель Owner'
                                : 'Админ-панель'}
                        </Link>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setProfileOpen(false);
                          void logout();
                        }}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-[var(--c-muted)] transition hover:bg-[var(--c-hover)] hover:text-[#e57373]"
                      >
                        <IconLogout className="h-3.5 w-3.5" />
                        {t('chat.logout')}
                      </button>
                    </>
                  ) : (
                    <div className="space-y-1">
                      <button
                        type="button"
                        onClick={() => {
                          setProfileOpen(false);
                          setSettingsOpen(true);
                        }}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-[var(--c-muted)] transition hover:bg-[var(--c-hover)] hover:text-[var(--c-text)]"
                      >
                        <IconSettings className="h-3.5 w-3.5" />
                        {t('chat.settings')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setProfileOpen(false);
                          setLimitsOpen(true);
                        }}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-[var(--c-muted)] transition hover:bg-[var(--c-hover)] hover:text-[var(--c-text)]"
                      >
                        <IconLimits className="h-3.5 w-3.5" />
                        Лимиты
                      </button>
                      <Link
                        to="/pricing"
                        onClick={() => setProfileOpen(false)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-[var(--c-muted)] transition hover:bg-[var(--c-hover)] hover:text-[var(--c-text)]"
                      >
                        <IconPricing className="h-3.5 w-3.5" />
                        Тарифы
                      </Link>
                      <Link
                        to="/support"
                        onClick={() => setProfileOpen(false)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-[var(--c-muted)] transition hover:bg-[var(--c-hover)] hover:text-[var(--c-text)]"
                      >
                        <IconSupport className="h-3.5 w-3.5" />
                        Поддержка
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode('login');
                          setAuthOpen(true);
                          setProfileOpen(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg border border-[var(--c-border)] px-3 py-2.5 text-left transition hover:bg-[var(--c-hover)]"
                      >
                        <IconUser className="h-4 w-4 text-[var(--c-muted)]" />
                        <span>
                          <span className="block text-[12px] font-medium text-[var(--c-text)]">{t('chat.login')}</span>
                          <span className="block text-[10px] text-[var(--c-faint)]">{t('chat.login.hint')}</span>
                        </span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </aside>

      {settingsOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Закрыть"
            className="ui-backdrop absolute inset-0 bg-black/60 backdrop-blur-[2px]"
            onClick={() => setSettingsOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="chat-settings-title"
            className="ui-sheet relative z-10 w-full max-w-sm overflow-hidden rounded-2xl border border-[var(--c-border-strong)] bg-[var(--c-panel)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--c-border)] px-4 py-3">
              <div className="flex items-center gap-2">
                <IconSettings className="h-4 w-4 text-[var(--c-muted)]" />
                <h2 id="chat-settings-title" className="text-[14px] font-semibold text-[var(--c-text)]">
                  {t('chat.settings')}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="rounded-md p-1.5 text-[var(--c-faint)] transition hover:bg-[var(--c-hover)] hover:text-[var(--c-text)]"
                aria-label="Закрыть"
              >
                <IconClose className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-5 p-4">
              <div>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[var(--c-faint)]">
                  {t('chat.language')}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { id: 'ru' as AppLanguage, label: 'Русский' },
                      { id: 'en' as AppLanguage, label: 'English' },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setLanguage(opt.id)}
                      className={`rounded-lg px-3 py-2.5 text-[13px] transition ${
                        language === opt.id
                          ? 'bg-[var(--c-soft)] text-[var(--c-text)] ring-1 ring-[#c62828]/40'
                          : 'bg-[var(--c-input)] text-[var(--c-muted)] hover:text-[var(--c-text)]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[var(--c-faint)]">
                  {t('chat.theme')}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { id: 'dark' as AppTheme, label: t('chat.theme.dark') },
                      { id: 'light' as AppTheme, label: t('chat.theme.light') },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setTheme(opt.id)}
                      className={`rounded-lg px-3 py-2.5 text-[13px] transition ${
                        theme === opt.id
                          ? 'bg-[var(--c-soft)] text-[var(--c-text)] ring-1 ring-[#c62828]/40'
                          : 'bg-[var(--c-input)] text-[var(--c-muted)] hover:text-[var(--c-text)]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-[var(--c-faint)]">
                  {t('chat.scale')}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'sm' as UiScale, label: t('chat.scale.sm') },
                      { id: 'md' as UiScale, label: t('chat.scale.md') },
                      { id: 'lg' as UiScale, label: t('chat.scale.lg') },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setUiScale(opt.id)}
                      className={`rounded-lg px-3 py-2.5 text-[13px] transition ${
                        uiScale === opt.id
                          ? 'bg-[var(--c-soft)] text-[var(--c-text)] ring-1 ring-[#c62828]/40'
                          : 'bg-[var(--c-input)] text-[var(--c-muted)] hover:text-[var(--c-text)]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <AuthModal
        open={authOpen}
        mode={authMode}
        onClose={() => setAuthOpen(false)}
        onModeChange={setAuthMode}
      />

      {menuChat &&
        menuPos &&
        createPortal(
          <div
            ref={chatMenuRef}
            role="menu"
            className="chat-app fixed z-[120] w-44 overflow-hidden rounded-lg border border-[var(--c-border-strong)] bg-[var(--c-panel)] py-1 shadow-2xl"
            style={{
              top: menuPos.top,
              left: menuPos.left,
              transform: menuPos.openUp ? 'translateY(-100%)' : undefined,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {chatMenuItems.map((item) => (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                onClick={() => {
                  item.action();
                  closeChatMenu();
                }}
                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] transition hover:bg-[var(--c-hover)] ${
                  item.danger ? 'text-[#e57373]' : 'text-[var(--c-muted)] hover:text-[var(--c-text)]'
                }`}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )}

      {sidebarOpen && (
        <button
          type="button"
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          aria-label="Закрыть"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main */}
      <section className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              className="rounded-md p-1.5 text-[var(--c-muted)] hover:bg-[var(--c-hover)] hover:text-[var(--c-text)] lg:hidden"
              onClick={() => setSidebarOpen((v) => !v)}
              aria-label="Меню"
            >
              <IconMenu className="h-4 w-4" />
            </button>
            {active && (
              <p className="truncate text-[14px] font-medium text-[var(--c-text)]">{active.title}</p>
            )}
          </div>
        </header>

        {!active ? (
          <div className="anim-pop flex flex-1 flex-col items-center justify-center px-6">
            <IconChat className="mb-4 h-7 w-7 animate-pulse text-[var(--c-border-strong)]" />
            <p className="text-[15px] font-medium text-[var(--c-text)]">{t('chat.empty')}</p>
            <p className="mt-1.5 max-w-xs text-center text-[13px] text-[var(--c-muted)]">
              {t('chat.empty.hint')}
            </p>
            <button
              type="button"
              onClick={() => createChat(null)}
              className="mt-6 rounded-lg px-4 py-2 text-[13px] font-medium text-white transition hover:brightness-110 hover:scale-[1.03] active:scale-95"
              style={{ background: ACCENT }}
            >
              {t('chat.create')}
            </button>
          </div>
        ) : (
          <>
            <div className="chat-thread-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
              <div className="mx-auto flex min-h-full max-w-[720px] flex-col px-4 py-4 sm:px-6">
                {!active.messages.length ? (
                  <div className="anim-pop flex flex-1 flex-col items-center justify-center text-center">
                    <IconChat className="mb-3 h-6 w-6 text-[var(--c-border-strong)]" />
                    <p className="text-[15px] text-[var(--c-text)]">{active.title}</p>
                    <p className="mt-1 text-[13px] text-[var(--c-muted)]">{t('chat.first')}</p>
                  </div>
                ) : (
                  <div className="space-y-5 py-2">
                    {active.messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`group/msg flex min-w-0 flex-col ${
                          msg.role === 'user' ? 'items-end' : 'items-stretch'
                        }`}
                      >
                        {msg.role === 'user' ? (
                          <div className="anim-msg chat-md max-w-[min(85%,42rem)] rounded-2xl rounded-br-md bg-[var(--c-soft)] px-3.5 py-2.5 text-[15px] leading-relaxed break-words text-[var(--c-text)] [&_pre]:text-[13px]">
                            <MarkdownBody content={msg.content} />
                          </div>
                        ) : (
                          <div className="anim-msg min-w-0">
                            <AssistantReply
                              content={msg.content}
                              modelId={msg.modelId ?? active.modelId}
                              reasoning={msg.reasoning}
                              reasoningMs={msg.reasoningMs}
                              thinkingPhase={msg.thinkingPhase}
                              createdAt={msg.createdAt}
                              live={Boolean(
                                sending &&
                                  (!msg.content ||
                                    msg.thinkingPhase === 'thinking' ||
                                    msg.thinkingPhase === 'answering'),
                              )}
                            />
                          </div>
                        )}
                        {msg.content ? (
                          <div
                            className={`mt-1.5 flex items-center gap-2 opacity-0 transition group-hover/msg:opacity-100 ${
                              msg.role === 'user' ? 'justify-end' : ''
                            }`}
                          >
                            <button
                              type="button"
                              onClick={() => void navigator.clipboard.writeText(msg.content)}
                              className="inline-flex items-center gap-1 text-[10px] text-[var(--c-faint)] hover:text-[var(--c-muted)]"
                            >
                              <IconCopy className="h-2.5 w-2.5" />
                              копировать
                            </button>
                          </div>
                        ) : null}
                      </div>
                    ))}
                    <div ref={endRef} />
                  </div>
                )}
              </div>
            </div>

            <div className="shrink-0 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-4">
              {adminWarning && (
                <div className="mx-auto mb-2 max-w-[720px] rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] text-[var(--c-text)]">
                  <p className="font-medium text-amber-200/90">Предупреждение модерации</p>
                  <p className="mt-0.5 text-[var(--c-muted)]">{adminWarning}</p>
                </div>
              )}
              {limitHint && (
                <div className="mx-auto mb-2 flex max-w-[720px] items-center justify-between gap-3 rounded-xl border border-[#c62828]/35 bg-[#c62828]/10 px-3 py-2 text-[12px] text-[var(--c-text)]">
                  <span>{limitHint}</span>
                  <Link to="/pricing" className="shrink-0 font-medium text-[#c62828] hover:underline">
                    Тарифы
                  </Link>
                </div>
              )}
              <form onSubmit={onSubmit} className="mx-auto max-w-[720px]">
                <div className="chat-composer rounded-2xl border border-[var(--c-border-strong)] bg-[var(--c-elev)]">
                  <textarea
                    ref={textareaRef}
                    value={draft}
                    onChange={(e) => onDraftChange(e.target.value)}
                    onKeyDown={onKeyDown}
                    maxLength={MAX_CHARS}
                    rows={1}
                    placeholder={t('chat.message')}
                    className="max-h-[140px] min-h-[44px] w-full resize-none bg-transparent px-3.5 pt-3 pb-1 text-[15px] text-[var(--c-text)] outline-none placeholder:text-[var(--c-faint)] sm:min-h-[48px] sm:px-4 sm:pt-3.5"
                  />
                  <div className="flex items-center justify-between gap-3 px-3 pb-2.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="relative" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setModelOpen((v) => !v)}
                          className="inline-flex items-center gap-1 rounded-md border border-[var(--c-border)] bg-[var(--c-soft)] px-2 py-1 text-[11px] font-medium text-[var(--c-text)] transition hover:border-[var(--c-border-strong)] hover:bg-[var(--c-elev)] hover:text-[var(--c-text)]"
                          aria-label="Выбор модели"
                        >
                          {MODELS.find((m) => m.id === active.modelId)?.tab ?? 'Mini K1'}
                          <IconChevronDown
                            className={`h-3 w-3 text-[var(--c-faint)] transition ${modelOpen ? 'rotate-180' : ''}`}
                          />
                        </button>
                        {modelOpen && (
                          <div className="anim-pop absolute bottom-full left-0 z-40 mb-2 w-60 overflow-hidden rounded-xl border border-[var(--c-border-strong)] bg-[var(--c-panel)] py-1 shadow-2xl">
                            {MODELS.map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => setModel(m.id)}
                                className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-[var(--c-text)] transition hover:bg-[var(--c-hover)]"
                              >
                                <span className="w-3 text-[#c62828]">
                                  {active.modelId === m.id ? <IconCheck className="h-3 w-3" /> : null}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block text-[var(--c-text)]">{m.name}</span>
                                  <span className="block text-[11px] text-[var(--c-faint)]">
                                    {m.desc}
                                  </span>
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setReasoning(!active.reasoning)}
                        className={`inline-flex h-7 items-center justify-center gap-1 overflow-hidden rounded-md border text-[11px] font-medium transition-all duration-300 ease-out ${
                          active.reasoning
                            ? 'border-[var(--x-red,#c62828)]/50 bg-[var(--x-red-soft,rgba(198,40,40,0.12))] px-2 text-[var(--c-text)]'
                            : 'w-7 border-[var(--c-border)] bg-[var(--c-soft)] px-0 text-[var(--c-muted)] hover:border-[var(--c-border-strong)] hover:text-[var(--c-text)]'
                        }`}
                        aria-label="Рассуждения"
                        aria-pressed={Boolean(active.reasoning)}
                        title="Сначала мысли, потом ответ"
                      >
                        <IconBrain className="h-3.5 w-3.5 shrink-0 translate-x-0" />
                        <span
                          className={`inline-block overflow-hidden whitespace-nowrap transition-all duration-300 ease-out ${
                            active.reasoning
                              ? 'max-w-[6.5rem] opacity-100'
                              : 'max-w-0 opacity-0'
                          }`}
                        >
                          Рассуждения
                        </span>
                      </button>
                      <span
                        className={`text-[11px] tabular-nums transition-colors ${
                          draft.length > 1800 ? 'text-[#e57373]' : 'text-[var(--c-faint)]'
                        }`}
                      >
                        {draft.length}/{MAX_CHARS}
                      </span>
                    </div>
                    <button
                      type="submit"
                      disabled={!draft.trim() || sending}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-white transition hover:brightness-110 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:scale-100"
                      style={{ background: ACCENT }}
                      aria-label="Отправить"
                    >
                      <IconSend className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </>
        )}
      </section>

      <LimitsModal
        open={limitsOpen}
        onClose={() => setLimitsOpen(false)}
        plan={plan}
        usedToday={usageToday}
        answerCost={
          active
            ? creditCostForRequest(active.modelId, active.reasoning)
            : creditCostForRequest(DEFAULT_MODEL_ID, false)
        }
        planExpiresAt={planExpiresAt}
        modelId={active?.modelId ?? DEFAULT_MODEL_ID}
        reasoning={Boolean(active?.reasoning)}
      />
    </div>
  );
}
