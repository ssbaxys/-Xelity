import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import ChatMarkdown from '../../components/ChatMarkdown';
import ToolActivityCards from '../../components/ToolActivityCards';
import { useAuth } from '../../context/AuthContext';
import {
  adminAppendAssistantMessage,
  adminAppendUserMessage,
  watchAllUserChatIndexes,
  watchUserChatStore,
  type ChatStore,
  type ChatThread,
} from '../../lib/chatStore';
import {
  clearGodHold,
  GOD_MODE_OPTIONS,
  setGodChatMode,
  setInterceptDecision,
  watchGodChatControl,
  type GodChatControl,
  type GodChatMode,
} from '../../lib/godChat';
import { modelLabel, normalizeModelId } from '../../lib/models';
import { getPlan } from '../../lib/plans';
import { isUserBanned, watchAllUsers, type UserProfile } from '../../lib/rtdb';
import { resolveStaffRole } from '../../lib/staff';
import { requestXlaudeReply } from '../../lib/xlaude';
import { IconBrain, IconChevronDown } from '../../components/icons';
import AdminSelect from './AdminSelect';

type Step = 'users' | 'chats' | 'thread';
type SendAs = 'user' | 'model' | 'admin';

function IconWand({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 4V2m0 14v-2M8 9h2m10 0h2M5.5 5.5l1.5 1.5M17 17l1.5 1.5M5.5 18.5L7 17M17 7l1.5-1.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 15l-6 6m8.5-8.5L15 9l3.5-6.5L15 6l-3.5 6.5L9 15z" />
    </svg>
  );
}

function formatAgo(ts: number): string {
  if (!ts) return '—';
  const d = Date.now() - ts;
  if (d < 60_000) return 'только что';
  if (d < 3600_000) return `${Math.floor(d / 60_000)} мин`;
  if (d < 86400_000) return `${Math.floor(d / 3600_000)} ч`;
  return new Date(ts).toLocaleDateString('ru-RU');
}

export default function AdminChats() {
  const { can } = useAuth();
  const allowGod = can('chats.god');
  const [searchParams, setSearchParams] = useSearchParams();

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [indexes, setIndexes] = useState<
    { uid: string; updatedAt: number; threadCount: number; messageCount: number }[]
  >([]);

  const godMode = allowGod && searchParams.get('god') === '1';
  const selectedUid = searchParams.get('uid') || '';
  const threadId = searchParams.get('chat') || '';

  const [store, setStore] = useState<ChatStore | null>(null);
  const [godControl, setGodControl] = useState<GodChatControl | null>(null);
  const [userQuery, setUserQuery] = useState('');
  const [filterPlan, setFilterPlan] = useState<string>('all');
  const [filterFlag, setFilterFlag] = useState<'all' | 'banned' | 'muted' | 'staff' | 'hasChats'>('all');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [draft, setDraft] = useState('');
  const [sendAs, setSendAs] = useState<SendAs>('model');
  const [busy, setBusy] = useState(false);
  const [genHint, setGenHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [interceptLeft, setInterceptLeft] = useState(0);

  useEffect(() => watchAllUsers(setUsers), []);
  useEffect(() => watchAllUserChatIndexes(setIndexes), []);

  useEffect(() => {
    if (!selectedUid) {
      setStore(null);
      return;
    }
    return watchUserChatStore(selectedUid, (s) => {
      setStore(s);
      if (s?.folders?.length) {
        setExpandedFolders((prev) => {
          const next = { ...prev };
          for (const f of s.folders) {
            if (next[f.id] === undefined) next[f.id] = f.expanded !== false;
          }
          return next;
        });
      }
    });
  }, [selectedUid]);

  useEffect(() => {
    if (!godMode || !selectedUid || !threadId) {
      setGodControl(null);
      return;
    }
    return watchGodChatControl(selectedUid, threadId, setGodControl);
  }, [godMode, selectedUid, threadId]);

  useEffect(() => {
    if (!godControl?.interceptUntil) {
      setInterceptLeft(0);
      return;
    }
    const tick = () => {
      const left = Math.max(0, (godControl.interceptUntil || 0) - Date.now());
      setInterceptLeft(left);
    };
    tick();
    const id = window.setInterval(tick, 100);
    return () => window.clearInterval(id);
  }, [godControl?.interceptUntil, godControl?.interceptDecision]);

  const userMap = useMemo(() => {
    const m = new Map<string, UserProfile>();
    for (const u of users) m.set(u.uid, u);
    return m;
  }, [users]);

  const indexMap = useMemo(() => {
    const m = new Map<string, (typeof indexes)[0]>();
    for (const i of indexes) m.set(i.uid, i);
    return m;
  }, [indexes]);

  const cards = useMemo(() => {
    const q = userQuery.trim().toLowerCase();
    const uids = new Set<string>([
      ...users.map((u) => u.uid),
      ...indexes.map((i) => i.uid),
    ]);
    const list = [...uids].map((uid) => {
      const profile = userMap.get(uid);
      const idx = indexMap.get(uid);
      return {
        uid,
        profile,
        idx,
        email: profile?.email || '',
        name: profile?.name || '',
        plan: getPlan(profile?.plan).id,
        banned: isUserBanned(profile),
        muted: Boolean(profile?.muted),
        staff: resolveStaffRole(profile),
        threadCount: idx?.threadCount ?? 0,
        messageCount: idx?.messageCount ?? 0,
        updatedAt: idx?.updatedAt ?? profile?.createdAt ?? 0,
      };
    });

    return list
      .filter((c) => {
        if (filterPlan !== 'all' && c.plan !== filterPlan) return false;
        if (filterFlag === 'banned' && !c.banned) return false;
        if (filterFlag === 'muted' && !c.muted) return false;
        if (filterFlag === 'staff' && !c.staff) return false;
        if (filterFlag === 'hasChats' && c.threadCount < 1) return false;
        if (!q) return true;
        const hay = [
          c.uid,
          c.email,
          c.name,
          c.plan,
          c.staff || '',
          c.banned ? 'ban banned' : '',
          c.muted ? 'mute muted' : '',
          String(c.threadCount),
          String(c.messageCount),
        ]
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [users, indexes, userMap, indexMap, userQuery, filterPlan, filterFlag]);

  const step: Step = !selectedUid ? 'users' : !threadId ? 'chats' : 'thread';

  const thread: ChatThread | null =
    store?.chats.find((c) => c.id === threadId) ?? null;

  const goUsers = () => {
    const p: Record<string, string> = {};
    if (godMode) p.god = '1';
    setSearchParams(p, { replace: true });
    setDraft('');
    setError(null);
  };

  const goUser = (uid: string) => {
    const p: Record<string, string> = { uid };
    if (godMode) p.god = '1';
    setSearchParams(p, { replace: true });
    setDraft('');
    setError(null);
  };

  const goThread = (chatId: string) => {
    const p: Record<string, string> = { uid: selectedUid, chat: chatId };
    if (godMode) p.god = '1';
    setSearchParams(p, { replace: true });
    setDraft('');
    setError(null);
  };

  const onModeChange = async (mode: GodChatMode) => {
    if (!selectedUid || !threadId) return;
    setBusy(true);
    setError(null);
    try {
      await setGodChatMode(selectedUid, threadId, mode);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось сменить режим');
    } finally {
      setBusy(false);
    }
  };

  const onIntercept = async (decision: 'takeover' | 'skip') => {
    if (!selectedUid || !threadId) return;
    try {
      await setInterceptDecision(selectedUid, threadId, decision);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка перехвата');
    }
  };

  const onSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!godMode || !selectedUid || !thread || !draft.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const content = draft.trim();
      const asAdmin = sendAs === 'admin' || godControl?.mode === 'admin';
      if (sendAs === 'user') {
        await adminAppendUserMessage({
          uid: selectedUid,
          chatId: thread.id,
          content,
        });
      } else {
        await adminAppendAssistantMessage({
          uid: selectedUid,
          chatId: thread.id,
          content,
          replaceMessageId: godControl?.heldAssistantId || null,
          asAdmin,
        });
        await clearGodHold(selectedUid, thread.id);
      }
      setDraft('');
      setGenHint(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка отправки');
    } finally {
      setBusy(false);
    }
  };

  const onGenerateDraft = async () => {
    if (!godMode || !thread || !selectedUid) return;
    setBusy(true);
    setGenHint('Генерация в черновик…');
    setError(null);
    try {
      const history = thread.messages
        .filter((m) => m.content?.trim() && !m.serverLoad)
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
      const res = await requestXlaudeReply({
        modelId: normalizeModelId(thread.modelId),
        messages: history,
        maxTokens: 4096,
        systemExtra: thread.adminSystemPrompt,
        reasoning: Boolean(thread.reasoning),
        codingTools: Boolean(thread.codingTools),
        webTools: thread.webTools !== false,
      });
      setDraft(res.content || '');
      setSendAs(godControl?.mode === 'admin' ? 'admin' : 'model');
      setGenHint('Черновик готов — отредактируйте и отправьте');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка генерации');
      setGenHint(null);
    } finally {
      setBusy(false);
    }
  };

  const selectedProfile = userMap.get(selectedUid);
  const rootChats = (store?.chats || []).filter((c) => !c.folderId);
  const folders = store?.folders || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            {godMode ? (
              <span className="inline-flex items-center gap-2">
                <span className="rounded-md bg-[var(--admin-accent)]/20 px-2 py-0.5 text-[12px] font-bold uppercase tracking-wider text-[var(--a-accent-fg)]">
                  Режим бога
                </span>
                Чаты
              </span>
            ) : (
              'Чаты пользователей'
            )}
          </h2>
          <p className="text-sm text-[var(--a-muted)]">
            {step === 'users' && 'Карточки пользователей · поиск и фильтры'}
            {step === 'chats' && 'Папки и чаты · как у пользователя'}
            {step === 'thread' && (godMode ? 'История + управление' : 'Только чтение истории')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {step !== 'users' && (
            <button
              type="button"
              onClick={() => (step === 'thread' ? goUser(selectedUid) : goUsers())}
              className="rounded-lg border border-[var(--a-border)] px-3 py-1.5 text-xs text-[var(--a-muted)] hover:bg-[var(--a-hover)]"
            >
              ← Назад
            </button>
          )}
          {allowGod && (
            <button
              type="button"
              onClick={() => {
                const p: Record<string, string> = {};
                if (selectedUid) p.uid = selectedUid;
                if (threadId) p.chat = threadId;
                if (!godMode) p.god = '1';
                setSearchParams(p, { replace: true });
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                godMode
                  ? 'bg-[var(--admin-accent)] text-white'
                  : 'border border-[var(--a-border)] text-[var(--a-muted)] hover:bg-[var(--a-hover)]'
              }`}
            >
              {godMode ? 'Выйти из режима бога' : 'Режим бога'}
            </button>
          )}
        </div>
      </div>

      {error && <p className="admin-error-inline">{error}</p>}

      {/* ——— Шаг A: карточки пользователей ——— */}
      {step === 'users' && (
        <>
          <div className="admin-panel flex flex-col gap-3 p-3 sm:flex-row sm:items-end">
            <label className="block min-w-0 flex-1 text-xs text-[var(--a-muted)]">
              Поиск
              <input
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                placeholder="email, имя, uid, plan, ban…"
                className="mt-1 w-full rounded-lg border border-[var(--a-border)] bg-[var(--a-input)] px-3 py-2 text-sm outline-none focus:border-[var(--admin-accent)]/50"
              />
            </label>
            <div className="w-full sm:w-40">
              <p className="mb-1 text-xs text-[var(--a-muted)]">Тариф</p>
              <AdminSelect
                value={filterPlan}
                options={[
                  { value: 'all', label: 'Все' },
                  { value: 'free', label: 'Free' },
                  { value: 'pro', label: 'Pro' },
                  { value: 'max', label: 'Max' },
                ]}
                onChange={setFilterPlan}
                className="w-full"
              />
            </div>
            <div className="w-full sm:w-44">
              <p className="mb-1 text-xs text-[var(--a-muted)]">Фильтр</p>
              <AdminSelect
                value={filterFlag}
                options={[
                  { value: 'all', label: 'Все' },
                  { value: 'hasChats', label: 'Есть чаты' },
                  { value: 'banned', label: 'Забанены' },
                  { value: 'muted', label: 'Мут' },
                  { value: 'staff', label: 'Staff' },
                ]}
                onChange={(v) => setFilterFlag(v as typeof filterFlag)}
                className="w-full"
              />
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map((c) => (
              <button
                key={c.uid}
                type="button"
                onClick={() => goUser(c.uid)}
                className="admin-panel flex flex-col gap-1.5 p-3.5 text-left transition hover:border-[var(--admin-accent)]/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--a-text)]">
                      {c.name || c.email || 'Без имени'}
                    </p>
                    <p className="truncate text-[11px] text-[var(--a-faint)]">{c.email || c.uid}</p>
                  </div>
                  <span className="shrink-0 rounded-md bg-[var(--a-chip)] px-1.5 py-0.5 text-[10px] uppercase text-[var(--a-muted)]">
                    {c.plan}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 text-[10px] text-[var(--a-faint)]">
                  <span>{c.threadCount} чатов</span>
                  <span>·</span>
                  <span>{c.messageCount} сообщ.</span>
                  <span>·</span>
                  <span>{formatAgo(c.updatedAt)}</span>
                  {c.banned && (
                    <span className="rounded bg-[var(--a-danger-soft)] px-1 text-[var(--a-danger)]">ban</span>
                  )}
                  {c.muted && (
                    <span className="rounded bg-[var(--a-chip)] px-1">mute</span>
                  )}
                  {c.staff && (
                    <span className="rounded bg-[var(--admin-accent)]/15 px-1 text-[var(--a-accent-fg)]">
                      {c.staff}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
          {!cards.length && (
            <p className="p-6 text-center text-sm text-[var(--a-faint)]">Никого не найдено</p>
          )}
        </>
      )}

      {/* ——— Шаг B: папки / чаты ——— */}
      {step === 'chats' && (
        <div className="admin-panel space-y-3 p-3 sm:p-4">
          <div className="border-b border-[var(--a-border)] pb-2">
            <p className="text-sm font-medium">
              {selectedProfile?.name || selectedProfile?.email || selectedUid}
            </p>
            <p className="text-[11px] text-[var(--a-faint)]">{selectedProfile?.email}</p>
          </div>

          {!store && (
            <p className="text-sm text-[var(--a-faint)]">Загрузка чатов…</p>
          )}
          {store && !store.chats.length && (
            <p className="text-sm text-[var(--a-faint)]">У пользователя нет чатов</p>
          )}

          {folders.map((f) => {
            const inFolder = (store?.chats || []).filter((c) => c.folderId === f.id);
            const open = expandedFolders[f.id] !== false;
            return (
              <div key={f.id}>
                <button
                  type="button"
                  onClick={() =>
                    setExpandedFolders((p) => ({ ...p, [f.id]: !open }))
                  }
                  className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-sm font-medium hover:bg-[var(--a-hover)]"
                >
                  <IconChevronDown
                    className={`h-3.5 w-3.5 transition ${open ? '' : '-rotate-90'}`}
                  />
                  {f.title}
                  <span className="text-[11px] text-[var(--a-faint)]">({inFolder.length})</span>
                </button>
                {open && (
                  <div className="ml-3 space-y-0.5 border-l border-[var(--a-border)] pl-2">
                    {inFolder.map((c) => (
                      <ThreadRow key={c.id} chat={c} onClick={() => goThread(c.id)} />
                    ))}
                    {!inFolder.length && (
                      <p className="px-2 py-1 text-[11px] text-[var(--a-faint)]">Пусто</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {rootChats.length > 0 && (
            <div className="space-y-0.5">
              <p className="px-2 text-[11px] uppercase tracking-wider text-[var(--a-faint)]">
                Без папки
              </p>
              {rootChats.map((c) => (
                <ThreadRow key={c.id} chat={c} onClick={() => goThread(c.id)} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ——— Шаг C: история (+ god UI) ——— */}
      {step === 'thread' && thread && (
        <div className="space-y-3">
          <div className="admin-panel flex flex-wrap items-center justify-between gap-2 p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{thread.title || 'Без названия'}</p>
              <p className="text-[11px] text-[var(--a-faint)]">
                {modelLabel(normalizeModelId(thread.modelId))} ·{' '}
                {selectedProfile?.email || selectedUid}
              </p>
            </div>
            {godMode && (
              <div className="w-full max-w-xs sm:w-56">
                <AdminSelect
                  value={godControl?.mode || 'auto'}
                  options={GOD_MODE_OPTIONS.map((o) => ({
                    value: o.value,
                    label: o.label,
                    hint: o.hint,
                  }))}
                  onChange={(v) => void onModeChange(v)}
                  disabled={busy}
                  className="w-full"
                />
              </div>
            )}
          </div>

          {godMode && (
            <div className="admin-panel space-y-2 p-3 text-xs text-[var(--a-muted)]">
              <p className="font-medium text-[var(--a-strong)]">Инструменты чата</p>
              <div className="flex flex-wrap gap-1.5">
                <Chip on={thread.webTools !== false} label="Поиск / web" />
                <Chip on={Boolean(thread.codingTools)} label="Кодинг" />
                <Chip on={Boolean(thread.reasoning)} label="Рассуждения" />
              </div>
              {godControl?.mode === 'auto_manual' && interceptLeft > 0 && !godControl.interceptDecision && (
                <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-[var(--admin-accent)]/40 bg-[var(--admin-accent)]/10 px-3 py-2">
                  <span className="font-semibold text-[var(--a-accent-fg)]">
                    Перехват {(interceptLeft / 1000).toFixed(1)}с
                  </span>
                  <button
                    type="button"
                    onClick={() => void onIntercept('takeover')}
                    className="rounded-md bg-[var(--admin-accent)] px-2.5 py-1 text-[11px] font-semibold text-white"
                  >
                    Перехватить
                  </button>
                  <button
                    type="button"
                    onClick={() => void onIntercept('skip')}
                    className="rounded-md border border-[var(--a-border)] px-2.5 py-1 text-[11px]"
                  >
                    Пропустить → ИИ
                  </button>
                </div>
              )}
              {godControl?.queueActive && (
                <p className="text-[var(--a-accent-fg)]">
                  Очередь активна — пользователь ждёт ответа
                </p>
              )}
            </div>
          )}

          <div className="admin-panel max-h-[min(60vh,32rem)] space-y-3 overflow-y-auto p-3 sm:p-4">
            {thread.messages.map((m) => (
              <div
                key={m.id}
                className={`rounded-xl border border-[var(--a-border)] px-3 py-2 ${
                  m.role === 'user' ? 'bg-[var(--a-chip)]/40' : 'bg-[var(--a-input)]'
                }`}
              >
                <div className="mb-1 flex flex-wrap items-center gap-1.5 text-[10px] uppercase tracking-wider text-[var(--a-faint)]">
                  <span>{m.role === 'user' ? 'User' : m.asAdmin ? 'Admin' : 'Assistant'}</span>
                  {m.viaAdmin && (
                    <span className="rounded bg-[var(--admin-accent)]/20 px-1 text-[var(--a-accent-fg)]">
                      via admin
                    </span>
                  )}
                  {m.usedReasoning && (
                    <span className="inline-flex items-center gap-0.5">
                      <IconBrain className="h-3 w-3" /> reasoning
                    </span>
                  )}
                  {m.serverLoad && (
                    <span className="rounded bg-amber-500/20 px-1 text-amber-200">
                      load:{m.serverLoad}
                    </span>
                  )}
                  <span className="ml-auto normal-case">
                    {new Date(m.createdAt).toLocaleString('ru-RU')}
                  </span>
                </div>
                {m.reasoning && (
                  <details className="mb-1.5 text-[12px] text-[var(--a-muted)]">
                    <summary className="cursor-pointer">Рассуждения</summary>
                    <pre className="mt-1 whitespace-pre-wrap font-sans text-[12px]">{m.reasoning}</pre>
                  </details>
                )}
                {m.toolActivity?.length ? (
                  <div className="mb-2">
                    <p className="mb-1 text-[10px] uppercase text-[var(--a-faint)]">
                      Tools ({m.toolActivity.length})
                    </p>
                    <ToolActivityCards items={m.toolActivity} />
                  </div>
                ) : null}
                {m.content?.trim() ? (
                  <ChatMarkdown content={m.content} className="text-[13px] leading-[1.6]" />
                ) : m.serverLoad ? (
                  <p className="text-sm text-[var(--a-muted)] italic">
                    Ожидание ({m.serverLoad})…
                  </p>
                ) : (
                  <p className="text-sm text-[var(--a-faint)]">∅</p>
                )}
              </div>
            ))}
            {!thread.messages.length && (
              <p className="text-sm text-[var(--a-faint)]">Пустой чат</p>
            )}
          </div>

          {godMode && (
            <form onSubmit={(e) => void onSend(e)} className="admin-panel space-y-2 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <AdminSelect
                  value={sendAs}
                  options={[
                    { value: 'user', label: 'От имени user' },
                    { value: 'model', label: 'От имени модели' },
                    { value: 'admin', label: 'От лица админа' },
                  ]}
                  onChange={(v) => setSendAs(v)}
                  className="min-w-[10rem]"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onGenerateDraft()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--a-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--a-hover)] disabled:opacity-40"
                  title="Сгенерировать в черновик (не отправляет)"
                >
                  <IconWand className="h-3.5 w-3.5" />
                  В черновик
                </button>
                {genHint && (
                  <span className="text-[11px] text-[var(--a-accent-fg)]">{genHint}</span>
                )}
              </div>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={4}
                placeholder="Ответ… (можно подкрутить после генерации в черновик)"
                className="w-full resize-y rounded-lg border border-[var(--a-border)] bg-[var(--a-input)] px-3 py-2 text-sm outline-none focus:border-[var(--admin-accent)]/50"
              />
              <button
                type="submit"
                disabled={busy || !draft.trim()}
                className="rounded-lg bg-[var(--admin-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                Отправить
              </button>
            </form>
          )}
        </div>
      )}

      {step === 'thread' && !thread && (
        <p className="text-sm text-[var(--a-faint)]">Чат не найден</p>
      )}
    </div>
  );
}

function Chip({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className={`rounded-md px-2 py-0.5 text-[11px] ${
        on
          ? 'bg-[var(--admin-accent)]/20 text-[var(--a-accent-fg)]'
          : 'bg-[var(--a-chip)] text-[var(--a-faint)] line-through'
      }`}
    >
      {label}
    </span>
  );
}

function ThreadRow({ chat, onClick }: { chat: ChatThread; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-[var(--a-hover)]"
    >
      <span className="min-w-0 truncate font-medium">{chat.title || 'Без названия'}</span>
      <span className="shrink-0 text-[10px] text-[var(--a-faint)]">
        {chat.messages.length} · {formatAgo(chat.updatedAt)}
      </span>
    </button>
  );
}
