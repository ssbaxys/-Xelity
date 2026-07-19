import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getPlan } from '../../lib/plans';
import {
  adminAppendAssistantMessage,
  adminAppendUserMessage,
  watchAllUserChatIndexes,
  watchUserChatStore,
  type ChatStore,
  type ChatThread,
} from '../../lib/chatStore';
import { modelLabel, normalizeModelId } from '../../lib/models';
import { watchAllUsers, type UserProfile } from '../../lib/rtdb';
import { requestXlaudeReply } from '../../lib/xlaude';
import ChatMarkdown from '../../components/ChatMarkdown';
import { IconBrain, IconChevronDown } from '../../components/icons';
import AdminSelect from './AdminSelect';
import AdminCheckbox from './AdminCheckbox';

function MarkdownBody({ content }: { content: string }) {
  return <ChatMarkdown content={content} className="text-[13px] leading-[1.6] text-[var(--a-strong)]" />;
}

type SendAs = 'user' | 'model';

function IconWand({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 4V2m0 14v-2M8 9h2m10 0h2M5.5 5.5l1.5 1.5M17 17l1.5 1.5M5.5 18.5L7 17M17 7l1.5-1.5" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 15l-6 6m8.5-8.5L15 9l3.5-6.5L15 6l-3.5 6.5L9 15z" />
    </svg>
  );
}

export default function AdminChats() {
  const { can } = useAuth();
  const allowGod = can('chats.god');
  const [searchParams, setSearchParams] = useSearchParams();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [indexes, setIndexes] = useState<
    { uid: string; updatedAt: number; threadCount: number; messageCount: number }[]
  >([]);
  const [selectedUid, setSelectedUid] = useState<string>(() => searchParams.get('uid') || '');
  const [godMode, setGodMode] = useState(
    () => allowGod && searchParams.get('god') === '1',
  );
  const [store, setStore] = useState<ChatStore | null>(null);
  const [threadId, setThreadId] = useState<string>('');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [genHint, setGenHint] = useState<string | null>(null);
  const [sendAs, setSendAs] = useState<SendAs>('user');
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => watchAllUsers(setUsers), []);
  useEffect(() => watchAllUserChatIndexes(setIndexes), []);

  useEffect(() => {
    const fromUrl = searchParams.get('uid');
    if (fromUrl && fromUrl !== selectedUid) setSelectedUid(fromUrl);
    setGodMode(allowGod && searchParams.get('god') === '1');
  }, [searchParams, allowGod]);

  useEffect(() => {
    if (!selectedUid) {
      setStore(null);
      setThreadId('');
      return;
    }
    const nextParams: Record<string, string> = { uid: selectedUid };
    if (godMode) nextParams.god = '1';
    setSearchParams(nextParams, { replace: true });
    return watchUserChatStore(selectedUid, (s) => {
      setStore(s);
      setThreadId((prev) => {
        if (s?.chats.some((c) => c.id === prev)) return prev;
        return s?.chats[0]?.id ?? '';
      });
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
  }, [selectedUid, godMode, setSearchParams]);

  const userMap = useMemo(() => {
    const m = new Map<string, UserProfile>();
    for (const u of users) m.set(u.uid, u);
    return m;
  }, [users]);

  const userOptions = useMemo(() => {
    const fromIndex = indexes.map((i) => i.uid);
    const all = new Set([...fromIndex, ...users.map((u) => u.uid)]);
    return [...all].map((uid) => {
      const u = userMap.get(uid);
      const idx = indexes.find((i) => i.uid === uid);
      return {
        value: uid,
        label: u?.email || u?.name || uid.slice(0, 8),
        hint: idx
          ? `${idx.threadCount} чатов · ${idx.messageCount} сообщ.`
          : 'нет сохранённых чатов',
      };
    });
  }, [indexes, users, userMap]);

  const thread = store?.chats.find((c) => c.id === threadId) ?? null;
  const selectedUser = selectedUid ? userMap.get(selectedUid) : null;
  const modelId = normalizeModelId(thread?.modelId);
  const modelName = modelLabel(modelId);

  const rootChats = useMemo(
    () => (store?.chats || []).filter((c) => !c.folderId),
    [store],
  );
  const folders = store?.folders ?? [];

  const chatsInFolder = (folderId: string) =>
    (store?.chats || []).filter((c) => c.folderId === folderId);

  const onSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedUid || !threadId || !draft.trim()) return;
    setBusy(true);
    setError(null);
    setGenHint(null);
    try {
      const text = draft.trim();
      setDraft('');

      if (sendAs === 'model') {
        const next = await adminAppendAssistantMessage({
          uid: selectedUid,
          chatId: threadId,
          content: text,
        });
        setStore(next);
      } else {
        const next = await adminAppendUserMessage({
          uid: selectedUid,
          chatId: threadId,
          content: text,
        });
        setStore(next);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка отправки');
    } finally {
      setBusy(false);
    }
  };

  /** Волшебная палочка: сгенерировать ответ модели в поле ввода */
  const onWandGenerate = async () => {
    if (!selectedUid || !threadId || busy) return;
    const chat = store?.chats.find((c) => c.id === threadId);
    if (!chat) {
      setError('Чат не найден');
      return;
    }
    setBusy(true);
    setError(null);
    setGenHint('Ответ перегенерируется…');
    try {
      const plan = getPlan(selectedUser?.plan);
      const apiMessages = chat.messages.map((m) => ({ role: m.role, content: m.content }));
      const hint = draft.trim();
      if (hint) {
        apiMessages.push({
          role: 'user',
          content: `[Подсказка для ответа ассистента]\n${hint}`,
        });
      }
      const { content } = await requestXlaudeReply({
        modelId: chat.modelId,
        messages: apiMessages,
        maxTokens: plan.maxTokens,
      });
      setDraft(content);
      setSendAs('model');
      setGenHint('Готово — ответ в поле ввода. Нажмите «Отправить».');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сгенерировать');
      setGenHint(null);
    } finally {
      setBusy(false);
    }
  };

  const renderChatButton = (c: ChatThread, nested = false) => (
    <button
      key={c.id}
      type="button"
      onClick={() => setThreadId(c.id)}
      className={`mb-0.5 w-full rounded-lg px-2 py-2 text-left text-xs hover:bg-[var(--a-hover)] ${
        nested ? 'pl-4' : ''
      } ${threadId === c.id ? 'bg-[var(--admin-accent)]/15' : ''}`}
    >
      <span className="block truncate font-medium">{c.title || 'Без названия'}</span>
      <span className="text-[10px] text-[var(--a-faint)]">
        {c.messages.length} сообщ. · {modelLabel(c.modelId)}
      </span>
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">
            {godMode ? 'Режим бога' : 'Чаты пользователей'}
          </h2>
          <p className="text-sm text-[var(--a-muted)]">
            {godMode
              ? 'Папки, markdown и ответ от лица модели пользователя'
              : 'Просмотр облачных чатов и отправка от лица пользователя'}
          </p>
        </div>
        {allowGod && (
          <AdminCheckbox
            checked={godMode}
            onChange={setGodMode}
            label="Режим бога"
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <AdminSelect
          value={selectedUid || (userOptions[0]?.value ?? '')}
          options={
            userOptions.length
              ? userOptions
              : [{ value: '', label: 'Нет пользователей', hint: '—' }]
          }
          onChange={(v) => {
            setSelectedUid(v);
            setThreadId('');
          }}
          className="min-w-[14rem]"
        />
      </div>

      {!selectedUid ? (
        <p className="text-sm text-[var(--a-faint)]">Выберите пользователя</p>
      ) : !store || !store.chats.length ? (
        <p className="admin-panel p-6 text-center text-sm text-[var(--a-faint)]">
          У пользователя ещё нет чатов в базе
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <div className="admin-panel max-h-[70vh] overflow-y-auto p-2">
            {godMode &&
              folders.map((folder) => {
                const inner = chatsInFolder(folder.id);
                const open = expandedFolders[folder.id] !== false;
                return (
                  <div key={folder.id} className="mb-1">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedFolders((prev) => ({
                          ...prev,
                          [folder.id]: !open,
                        }))
                      }
                      className="mb-0.5 flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-[11px] font-medium text-[var(--a-soft)] hover:bg-[var(--a-hover)]"
                    >
                      <IconChevronDown
                        className={`h-3 w-3 shrink-0 text-[var(--a-faint)] transition-transform ${
                          open ? 'rotate-0' : '-rotate-90'
                        }`}
                      />
                      <span className="truncate">{folder.title}</span>
                      <span className="ml-auto text-[10px] text-[var(--a-faint)]">{inner.length}</span>
                    </button>
                    {open &&
                      (inner.length
                        ? inner.map((c) => renderChatButton(c, true))
                        : (
                          <p className="px-4 py-1 text-[10px] text-[var(--a-faint)]">Пусто</p>
                        ))}
                  </div>
                );
              })}

            {godMode && folders.length > 0 && rootChats.length > 0 && (
              <p className="mb-1 mt-2 px-2 text-[10px] uppercase tracking-wider text-[var(--a-faint)]">
                Без папки
              </p>
            )}

            {(godMode ? rootChats : store.chats).map((c) => renderChatButton(c))}

            {godMode && !folders.length && !rootChats.length && (
              <p className="p-3 text-center text-xs text-[var(--a-faint)]">Нет чатов</p>
            )}
          </div>

          <div className="admin-panel flex min-h-[480px] flex-col">
            <div className="border-b border-[var(--a-border)] px-4 py-3">
              <p className="font-medium">{thread?.title ?? '—'}</p>
              <p className="text-[11px] text-[var(--a-muted)]">
                {selectedUser?.email || selectedUid}
                {thread && (
                  <>
                    {' · '}
                    модель пользователя:{' '}
                    <span className="text-[var(--a-accent-fg)]">{modelName}</span>
                  </>
                )}
                {godMode && ' · god mode'}
              </p>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              {thread?.messages.map((m, i) => {
                const next = thread.messages[i + 1];
                const usedReasoning =
                  m.role === 'user' &&
                  (Boolean(m.usedReasoning) ||
                    (next?.role === 'assistant' && Boolean(next.reasoning?.trim())));
                return (
                  <div
                    key={m.id}
                    className={`max-w-[92%] rounded-xl px-3 py-2 text-sm ${
                      m.role === 'user' ? 'ml-auto bg-[var(--a-chip)]' : 'bg-[var(--admin-accent)]/10'
                    }`}
                  >
                    <p className="flex items-center gap-1.5 text-[10px] text-[var(--a-faint)]">
                      <span>
                        {m.role === 'user' ? 'user' : `assistant · ${modelName}`}
                        {m.viaAdmin ? ' · via admin' : ''}
                      </span>
                      {usedReasoning && (
                        <span
                          className="inline-flex items-center gap-0.5 rounded bg-[var(--admin-accent)]/20 px-1 py-0.5 text-[var(--a-accent-fg)]"
                          title="Пользователь включил «Рассуждения»"
                        >
                          <IconBrain className="h-3 w-3" />
                          <span className="text-[9px] font-medium uppercase tracking-wide">
                            reason
                          </span>
                        </span>
                      )}
                    </p>
                    <div className="mt-1">
                      <MarkdownBody content={m.content} />
                    </div>
                    {m.role === 'assistant' && m.reasoning?.trim() && (
                      <details className="mt-2 rounded-lg border border-[var(--a-border)] bg-[var(--a-input)]/60 px-2 py-1.5">
                        <summary className="cursor-pointer text-[10px] text-[var(--a-muted)]">
                          Мысли модели
                        </summary>
                        <p className="mt-1 whitespace-pre-wrap text-[11px] leading-relaxed text-[var(--a-faint)]">
                          {m.reasoning}
                        </p>
                      </details>
                    )}
                  </div>
                );
              })}
              {!thread?.messages.length && (
                <p className="text-center text-sm text-[var(--a-faint)]">Пустой чат</p>
              )}
            </div>

            <form onSubmit={onSend} className="space-y-2 border-t border-[var(--a-border)] p-3">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSendAs('user')}
                  className={`rounded-md border px-2.5 py-1 text-[11px] ${
                    sendAs === 'user'
                      ? 'border-[var(--admin-accent)] bg-[var(--admin-accent)]/15 text-[var(--a-accent-fg)]'
                      : 'border-[var(--a-border)] text-[var(--a-muted)]'
                  }`}
                >
                  От лица пользователя
                </button>
                <button
                  type="button"
                  onClick={() => setSendAs('model')}
                  className={`rounded-md border px-2.5 py-1 text-[11px] ${
                    sendAs === 'model'
                      ? 'border-[var(--admin-accent)] bg-[var(--admin-accent)]/15 text-[var(--a-accent-fg)]'
                      : 'border-[var(--a-border)] text-[var(--a-muted)]'
                  }`}
                >
                  От лица модели ({modelName})
                </button>
              </div>

              {genHint && (
                <p className="text-[11px] text-[var(--a-accent-fg)]">{genHint}</p>
              )}
              {error && <p className="text-xs text-red-400">{error}</p>}
              <div className="flex gap-2">
                <textarea
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    if (genHint?.startsWith('Готово')) setGenHint(null);
                  }}
                  rows={godMode ? 3 : 1}
                  placeholder={
                    sendAs === 'model'
                      ? `Текст ответа модели (${modelName})…`
                      : 'Сообщение от лица пользователя…'
                  }
                  className="min-w-0 flex-1 resize-y rounded-lg border border-[var(--a-border)] bg-[var(--a-input)] px-3 py-2 text-sm outline-none"
                />
                <button
                  type="button"
                  disabled={busy || !thread}
                  onClick={() => void onWandGenerate()}
                  title="Сгенерировать ответ в поле"
                  aria-label="Сгенерировать ответ"
                  className="self-end inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--admin-accent)]/45 bg-[var(--admin-accent)]/15 text-[var(--a-accent-fg)] hover:bg-[var(--admin-accent)]/25 disabled:opacity-40"
                >
                  <IconWand className="h-4 w-4" />
                </button>
                <button
                  type="submit"
                  disabled={busy || !draft.trim() || !thread}
                  className="self-end rounded-lg bg-[var(--admin-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                >
                  {busy ? '…' : 'Отправить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
