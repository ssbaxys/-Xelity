import { get, onValue, ref, set, update, type Unsubscribe } from 'firebase/database';
import { database } from './firebase';
import { normalizePrankIds, type GodPrankId } from './godPranks';

export type GodChatMode = 'auto' | 'auto_manual' | 'manual' | 'admin';

export type InterceptDecision = 'takeover' | 'skip' | null;

export type GodChatControl = {
  mode: GodChatMode;
  updatedAt: number;
  /** unix ms — до этого момента Owner может перехватить */
  interceptUntil?: number | null;
  interceptDecision?: InterceptDecision;
  /** manual/admin: чат в очереди, пользователь не может слать */
  queueActive?: boolean;
  queueReason?: string | null;
  heldAssistantId?: string | null;
  pendingJobId?: string | null;
  /** Системный промпт поверх остальных (режим бога) */
  godSystemPrompt?: string | null;
  /** Активные троллинг-механики */
  pranks?: GodPrankId[];
};

export const GOD_MODE_OPTIONS: { value: GodChatMode; label: string; hint: string }[] = [
  { value: 'auto', label: 'Авто', hint: 'ИИ отвечает как обычно' },
  {
    value: 'auto_manual',
    label: 'Авто + ручной',
    hint: '5 сек на перехват перед генерацией',
  },
  { value: 'manual', label: 'Ручной', hint: 'Только ответ владельца, чат в очереди' },
  { value: 'admin', label: 'Админ', hint: 'Ответы от лица администрации' },
];

export function defaultGodControl(mode: GodChatMode = 'auto'): GodChatControl {
  return { mode, updatedAt: Date.now(), pranks: [], godSystemPrompt: null };
}

export function normalizeGodControl(raw: unknown): GodChatControl {
  const v = (raw || {}) as Partial<GodChatControl>;
  const mode: GodChatMode =
    v.mode === 'auto_manual' || v.mode === 'manual' || v.mode === 'admin' || v.mode === 'auto'
      ? v.mode
      : 'auto';
  return {
    mode,
    updatedAt: typeof v.updatedAt === 'number' ? v.updatedAt : Date.now(),
    interceptUntil: v.interceptUntil ?? null,
    interceptDecision: v.interceptDecision ?? null,
    queueActive: Boolean(v.queueActive),
    queueReason: v.queueReason ?? null,
    heldAssistantId: v.heldAssistantId ?? null,
    pendingJobId: v.pendingJobId ?? null,
    godSystemPrompt:
      typeof v.godSystemPrompt === 'string' ? v.godSystemPrompt.slice(0, 8000) : null,
    pranks: normalizePrankIds(v.pranks),
  };
}

export async function fetchGodChatControl(
  uid: string,
  chatId: string,
): Promise<GodChatControl> {
  const snap = await get(ref(database, `godChatControl/${uid}/${chatId}`));
  if (!snap.exists()) return defaultGodControl('auto');
  return normalizeGodControl(snap.val());
}

export function watchGodChatControl(
  uid: string,
  chatId: string,
  cb: (control: GodChatControl) => void,
): Unsubscribe {
  return onValue(ref(database, `godChatControl/${uid}/${chatId}`), (snap) => {
    cb(snap.exists() ? normalizeGodControl(snap.val()) : defaultGodControl('auto'));
  });
}

export async function setGodChatMode(
  uid: string,
  chatId: string,
  mode: GodChatMode,
): Promise<void> {
  const prev = await fetchGodChatControl(uid, chatId);
  const next: GodChatControl = {
    ...prev,
    mode,
    updatedAt: Date.now(),
    queueActive: mode === 'manual' || mode === 'admin' ? prev.queueActive : false,
    queueReason: mode === 'manual' || mode === 'admin' ? prev.queueReason : null,
    interceptUntil: null,
    interceptDecision: null,
    heldAssistantId: null,
    pendingJobId: null,
  };
  await set(ref(database, `godChatControl/${uid}/${chatId}`), next);
}

export async function setGodSystemPrompt(
  uid: string,
  chatId: string,
  prompt: string | null,
): Promise<void> {
  const prev = await fetchGodChatControl(uid, chatId);
  await set(ref(database, `godChatControl/${uid}/${chatId}`), {
    ...prev,
    godSystemPrompt: (prompt || '').trim().slice(0, 8000) || null,
    updatedAt: Date.now(),
  });
}

export async function setGodPranks(
  uid: string,
  chatId: string,
  pranks: GodPrankId[],
): Promise<void> {
  const prev = await fetchGodChatControl(uid, chatId);
  await set(ref(database, `godChatControl/${uid}/${chatId}`), {
    ...prev,
    pranks: normalizePrankIds(pranks),
    updatedAt: Date.now(),
  });
}

export async function toggleGodPrank(
  uid: string,
  chatId: string,
  prankId: GodPrankId,
): Promise<void> {
  const prev = await fetchGodChatControl(uid, chatId);
  const cur = new Set(prev.pranks || []);
  if (cur.has(prankId)) cur.delete(prankId);
  else cur.add(prankId);
  await setGodPranks(uid, chatId, [...cur]);
}

export async function beginInterceptWindow(params: {
  uid: string;
  chatId: string;
  assistantId: string;
  jobId: string;
  ms?: number;
}): Promise<GodChatControl> {
  const ms = params.ms ?? 5000;
  const prev = await fetchGodChatControl(params.uid, params.chatId);
  const next: GodChatControl = {
    ...prev,
    updatedAt: Date.now(),
    interceptUntil: Date.now() + ms,
    interceptDecision: null,
    heldAssistantId: params.assistantId,
    pendingJobId: params.jobId,
    queueActive: false,
    queueReason: null,
  };
  await set(ref(database, `godChatControl/${params.uid}/${params.chatId}`), next);
  return next;
}

export async function setInterceptDecision(
  uid: string,
  chatId: string,
  decision: 'takeover' | 'skip',
): Promise<void> {
  await update(ref(database, `godChatControl/${uid}/${chatId}`), {
    interceptDecision: decision,
    updatedAt: Date.now(),
  });
}

export async function setGodQueue(params: {
  uid: string;
  chatId: string;
  active: boolean;
  reason?: string | null;
  heldAssistantId?: string | null;
}): Promise<void> {
  const prev = await fetchGodChatControl(params.uid, params.chatId);
  await set(ref(database, `godChatControl/${params.uid}/${params.chatId}`), {
    ...prev,
    queueActive: params.active,
    queueReason: params.active
      ? params.reason ||
        'Повышенная нагрузка на сервер для этого чата. Вернитесь позже.'
      : null,
    heldAssistantId: params.heldAssistantId ?? prev.heldAssistantId ?? null,
    interceptUntil: null,
    interceptDecision: null,
    pendingJobId: null,
    updatedAt: Date.now(),
  });
}

export async function clearGodHold(uid: string, chatId: string): Promise<void> {
  const prev = await fetchGodChatControl(uid, chatId);
  await set(ref(database, `godChatControl/${uid}/${chatId}`), {
    ...prev,
    interceptUntil: null,
    interceptDecision: null,
    heldAssistantId: null,
    pendingJobId: null,
    queueActive: false,
    queueReason: null,
    updatedAt: Date.now(),
  });
}

/** Ждать решения Owner или таймаута. Возвращает takeover | skip */
export async function waitForInterceptDecision(
  uid: string,
  chatId: string,
  until: number,
): Promise<'takeover' | 'skip'> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v: 'takeover' | 'skip') => {
      if (done) return;
      done = true;
      unsub();
      window.clearInterval(tick);
      resolve(v);
    };
    const unsub = watchGodChatControl(uid, chatId, (c) => {
      if (c.interceptDecision === 'takeover') finish('takeover');
      else if (c.interceptDecision === 'skip') finish('skip');
    });
    const tick = window.setInterval(() => {
      if (Date.now() >= until) finish('skip');
    }, 150);
  });
}

/** Склеить god-промпт поверх thread/admin system extra */
export function composeGodSystemExtra(
  base: string | null | undefined,
  godPrompt: string | null | undefined,
): string | null {
  const a = (base || '').trim();
  const b = (godPrompt || '').trim();
  if (!a && !b) return null;
  if (!b) return a;
  if (!a) return `[Инструкция владельца — приоритет]\n${b}`;
  return `[Инструкция владельца — поверх остального]\n${b}\n\n${a}`;
}
