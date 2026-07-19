import { get, onValue, ref, update, type Unsubscribe } from 'firebase/database';
import { database } from './firebase';
import { normalizePrankIds, pranksToFirebase, type GodPrankId } from './godPranks';

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

function controlPath(uid: string, chatId: string) {
  return `godChatControl/${uid}/${chatId}`;
}

/** Только частичный update — не затираем mode/pranks чужим stale set() */
async function patchGodControl(
  uid: string,
  chatId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const clean: Record<string, unknown> = { updatedAt: Date.now() };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    clean[k] = v;
  }
  await update(ref(database, controlPath(uid, chatId)), clean);
}

export function defaultGodControl(mode: GodChatMode = 'auto'): GodChatControl {
  return { mode, updatedAt: Date.now(), pranks: [], godSystemPrompt: null };
}

export function normalizeGodControl(raw: unknown): GodChatControl {
  const v = (raw || {}) as Record<string, unknown>;
  const modeRaw = v.mode;
  const mode: GodChatMode =
    modeRaw === 'auto_manual' || modeRaw === 'manual' || modeRaw === 'admin' || modeRaw === 'auto'
      ? modeRaw
      : 'auto';
  const decision = v.interceptDecision;
  return {
    mode,
    updatedAt: typeof v.updatedAt === 'number' ? v.updatedAt : Date.now(),
    interceptUntil: typeof v.interceptUntil === 'number' ? v.interceptUntil : null,
    interceptDecision:
      decision === 'takeover' || decision === 'skip' ? decision : null,
    queueActive: Boolean(v.queueActive),
    queueReason: typeof v.queueReason === 'string' ? v.queueReason : null,
    heldAssistantId: typeof v.heldAssistantId === 'string' ? v.heldAssistantId : null,
    pendingJobId: typeof v.pendingJobId === 'string' ? v.pendingJobId : null,
    godSystemPrompt:
      typeof v.godSystemPrompt === 'string' ? v.godSystemPrompt.slice(0, 8000) : null,
    pranks: normalizePrankIds(v.pranks),
  };
}

export async function fetchGodChatControl(
  uid: string,
  chatId: string,
): Promise<GodChatControl> {
  const snap = await get(ref(database, controlPath(uid, chatId)));
  if (!snap.exists()) return defaultGodControl('auto');
  return normalizeGodControl(snap.val());
}

export function watchGodChatControl(
  uid: string,
  chatId: string,
  cb: (control: GodChatControl) => void,
): Unsubscribe {
  return onValue(ref(database, controlPath(uid, chatId)), (snap) => {
    cb(snap.exists() ? normalizeGodControl(snap.val()) : defaultGodControl('auto'));
  });
}

export async function setGodChatMode(
  uid: string,
  chatId: string,
  mode: GodChatMode,
): Promise<void> {
  // смена режима не трогает pranks; сбрасывает очередь/перехват
  await patchGodControl(uid, chatId, {
    mode,
    queueActive: false,
    queueReason: null,
    interceptUntil: null,
    interceptDecision: null,
    heldAssistantId: null,
    pendingJobId: null,
  });
}

export async function setGodSystemPrompt(
  uid: string,
  chatId: string,
  prompt: string | null,
): Promise<void> {
  const prev = await fetchGodChatControl(uid, chatId);
  await patchGodControl(uid, chatId, {
    mode: prev.mode,
    godSystemPrompt: (prompt || '').trim().slice(0, 8000) || null,
  });
}

export async function setGodPranks(
  uid: string,
  chatId: string,
  pranks: GodPrankId[],
): Promise<void> {
  const prev = await fetchGodChatControl(uid, chatId);
  await patchGodControl(uid, chatId, {
    mode: prev.mode || 'auto',
    pranks: pranksToFirebase(pranks),
  });
}

export async function toggleGodPrank(
  uid: string,
  chatId: string,
  prankId: GodPrankId,
): Promise<GodPrankId[]> {
  const prev = await fetchGodChatControl(uid, chatId);
  const cur = new Set(prev.pranks || []);
  if (cur.has(prankId)) cur.delete(prankId);
  else cur.add(prankId);
  const next = [...cur] as GodPrankId[];
  await setGodPranks(uid, chatId, next);
  return next;
}

export async function beginInterceptWindow(params: {
  uid: string;
  chatId: string;
  assistantId: string;
  jobId: string;
  ms?: number;
}): Promise<GodChatControl> {
  const ms = params.ms ?? 5000;
  const until = Date.now() + ms;
  await patchGodControl(params.uid, params.chatId, {
    interceptUntil: until,
    interceptDecision: null,
    heldAssistantId: params.assistantId,
    pendingJobId: params.jobId,
    queueActive: false,
    queueReason: null,
  });
  return fetchGodChatControl(params.uid, params.chatId);
}

export async function setInterceptDecision(
  uid: string,
  chatId: string,
  decision: 'takeover' | 'skip',
): Promise<void> {
  await patchGodControl(uid, chatId, {
    interceptDecision: decision,
  });
}

export async function setGodQueue(params: {
  uid: string;
  chatId: string;
  active: boolean;
  reason?: string | null;
  heldAssistantId?: string | null;
}): Promise<void> {
  await patchGodControl(params.uid, params.chatId, {
    queueActive: params.active,
    queueReason: params.active
      ? params.reason ||
        'Повышенная нагрузка на сервер для этого чата. Вернитесь позже.'
      : null,
    heldAssistantId: params.heldAssistantId ?? null,
    interceptUntil: null,
    interceptDecision: null,
    pendingJobId: null,
  });
}

export async function clearGodHold(uid: string, chatId: string): Promise<void> {
  await patchGodControl(uid, chatId, {
    interceptUntil: null,
    interceptDecision: null,
    heldAssistantId: null,
    pendingJobId: null,
    queueActive: false,
    queueReason: null,
  });
}

/** Сбросить перехват / очередь: не перехватывать, убрать залипшую «Очередь» */
export async function resetGodIntercept(uid: string, chatId: string): Promise<void> {
  await patchGodControl(uid, chatId, {
    interceptUntil: null,
    interceptDecision: 'skip',
    heldAssistantId: null,
    pendingJobId: null,
    queueActive: false,
    queueReason: null,
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
