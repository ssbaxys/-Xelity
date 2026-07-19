import { createHash } from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';
import { creditCostForRequest } from '../src/lib/models';
import { effectivePlanId, getPlan, todayKey, type PlanId } from '../src/lib/plans';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'xelity-site';
const DATABASE_URL =
  process.env.FIREBASE_DATABASE_URL ||
  'https://xelity-site-default-rtdb.europe-west1.firebasedatabase.app';

const GUEST_FILE =
  process.env.XELITY_GUEST_USAGE_FILE || '/opt/xelity/data/guest-usage.json';

type GuestStore = Record<string, { day: string; credits: number; messages: number }>;

function loadServiceAccount(): Record<string, unknown> | null {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (inline) {
    try {
      return JSON.parse(inline) as Record<string, unknown>;
    } catch {
      console.error('FIREBASE_SERVICE_ACCOUNT_JSON: invalid JSON');
    }
  }
  const filePath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    '/opt/xelity/firebase-service-account.json';
  if (existsSync(filePath)) {
    try {
      return JSON.parse(readFileSync(filePath, 'utf8')) as Record<string, unknown>;
    } catch (err) {
      console.error('Failed to read service account file', err);
    }
  }
  return null;
}

export function initFirebaseAdmin(): boolean {
  if (getApps().length) return true;
  const sa = loadServiceAccount();
  if (!sa) {
    console.warn(
      'Firebase Admin: нет service account. Положите JSON в /opt/xelity/firebase-service-account.json',
    );
    return false;
  }
  initializeApp({
    credential: cert(sa as Parameters<typeof cert>[0]),
    databaseURL: DATABASE_URL,
    projectId: (sa.project_id as string) || PROJECT_ID,
  });
  return true;
}

export type ServerUserGate = {
  uid: string | null;
  isGuest: boolean;
  isAdmin: boolean;
  planId: PlanId;
  cost: number;
  used: number;
  limit: number | null;
};

type UserRow = {
  plan?: string;
  planExpiresAt?: number | null;
  planUpdatedAt?: number | null;
  banned?: boolean;
  banUntil?: number | null;
  muted?: boolean;
  isAdmin?: boolean;
  admin?: boolean;
  staffRole?: string | null;
};

function isBanned(u: UserRow | null): boolean {
  if (!u?.banned) return false;
  if (typeof u.banUntil === 'number' && u.banUntil > 0) {
    return Date.now() < u.banUntil;
  }
  return true;
}

function readGuestStore(): GuestStore {
  try {
    if (!existsSync(GUEST_FILE)) return {};
    return JSON.parse(readFileSync(GUEST_FILE, 'utf8')) as GuestStore;
  } catch {
    return {};
  }
}

function writeGuestStore(store: GuestStore) {
  mkdirSync(path.dirname(GUEST_FILE), { recursive: true });
  writeFileSync(GUEST_FILE, JSON.stringify(store), 'utf8');
}

function guestKey(ip: string) {
  return createHash('sha256').update(ip).digest('hex').slice(0, 24);
}

export async function verifyIdToken(idToken: string): Promise<{ uid: string } | null> {
  initFirebaseAdmin();
  if (!getApps().length) return null;
  try {
    const decoded = await getAuth().verifyIdToken(idToken);
    return { uid: decoded.uid };
  } catch {
    return null;
  }
}

export async function assertCanGenerate(opts: {
  idToken?: string | null;
  ip: string;
  modelId: string;
  reasoning?: boolean;
}): Promise<{ ok: true; gate: ServerUserGate } | { ok: false; status: number; error: string }> {
  const ready = initFirebaseAdmin();
  const cost = creditCostForRequest(opts.modelId, opts.reasoning);
  const day = todayKey();

  if (opts.idToken) {
    if (!ready || !getApps().length) {
      return {
        ok: false,
        status: 503,
        error:
          'Сервер без Firebase Admin. Добавь service account (файл firebase-service-account.json) и перезапусти.',
      };
    }
    const verified = await verifyIdToken(opts.idToken);
    if (!verified) {
      return { ok: false, status: 401, error: 'Неверный или просроченный токен' };
    }

    const db = getDatabase();
    const snap = await db.ref(`users/${verified.uid}`).get();
    const user = (snap.val() || null) as UserRow | null;

    if (isBanned(user)) {
      return { ok: false, status: 403, error: 'Аккаунт заблокирован' };
    }
    if (user?.muted) {
      return { ok: false, status: 403, error: 'Чат временно недоступен (мут)' };
    }

    const planId = effectivePlanId({
      plan: user?.plan,
      planExpiresAt: user?.planExpiresAt,
      planUpdatedAt: user?.planUpdatedAt,
    });
    const plan = getPlan(planId);
    const usageSnap = await db.ref(`users/${verified.uid}/usage/${day}`).get();
    const usage = usageSnap.val() as { credits?: number; messages?: number } | null;
    const used =
      typeof usage?.credits === 'number' ? usage.credits : usage?.messages || 0;

    if (plan.creditsPerDay != null && used + cost > plan.creditsPerDay) {
      return {
        ok: false,
        status: 402,
        error: `Недостаточно кредитов (нужно ${cost}, осталось ${Math.max(0, plan.creditsPerDay - used)})`,
      };
    }

    // Бесплатные кредиты только у admin/owner (не у helper/moderator)
    const role = user?.staffRole;
    const isAdmin =
      role === 'admin' ||
      role === 'owner' ||
      ((user?.isAdmin === true || user?.admin === true) &&
        role !== 'helper' &&
        role !== 'moderator');
    return {
      ok: true,
      gate: {
        uid: verified.uid,
        isGuest: false,
        isAdmin,
        planId,
        cost,
        used,
        limit: plan.creditsPerDay,
      },
    };
  }

  const plan = getPlan('free');
  const key = guestKey(opts.ip);
  const store = readGuestStore();
  const row = store[key];
  const used = row && row.day === day ? row.credits : 0;
  if (plan.creditsPerDay != null && used + cost > plan.creditsPerDay) {
    return {
      ok: false,
      status: 402,
      error: 'Дневной лимит гостя исчерпан. Войдите в аккаунт.',
    };
  }
  return {
    ok: true,
    gate: {
      uid: null,
      isGuest: true,
      isAdmin: false,
      planId: 'free',
      cost,
      used,
      limit: plan.creditsPerDay,
    },
  };
}

export async function chargeAfterSuccess(
  gate: ServerUserGate,
  tokensApprox: number,
  ip: string,
): Promise<{ used: number; limit: number | null }> {
  const day = todayKey();
  const spend = Math.max(1, gate.cost);

  if (gate.uid && getApps().length) {
    const db = getDatabase();
    const usageRef = db.ref(`users/${gate.uid}/usage/${day}`);
    const result = await usageRef.transaction((current) => {
      const cur = (current || { messages: 0, tokensApprox: 0, credits: 0 }) as {
        messages?: number;
        tokensApprox?: number;
        credits?: number;
      };
      const prev =
        typeof cur.credits === 'number' ? cur.credits : cur.messages || 0;
      return {
        messages: (cur.messages || 0) + 1,
        tokensApprox: (cur.tokensApprox || 0) + Math.max(0, Math.round(tokensApprox)),
        credits: prev + spend,
      };
    });
    const next = result.snapshot.val() as { credits?: number } | null;
    const used = typeof next?.credits === 'number' ? next.credits : gate.used + spend;
    try {
      await db.ref(`analytics/messagesByDay/${day}`).transaction((c) =>
        (typeof c === 'number' ? c : 0) + 1,
      );
    } catch {
      /* optional */
    }
    return { used, limit: gate.limit };
  }

  const key = guestKey(ip);
  const store = readGuestStore();
  const prev = store[key]?.day === day ? store[key] : { day, credits: 0, messages: 0 };
  const next = {
    day,
    credits: prev.credits + spend,
    messages: prev.messages + 1,
  };
  store[key] = next;
  writeGuestStore(store);
  return { used: next.credits, limit: gate.limit };
}

export function maxTokensFor(gate: ServerUserGate, modelDefault: number): number {
  const planCap = getPlan(gate.planId).maxTokens;
  return Math.min(modelDefault, planCap);
}

/** Кэш админских system-промптов по модели (RTDB config/modelPrompts/{id}) */
const modelPromptCache = new Map<string, { text: string; at: number }>();
const MODEL_PROMPT_TTL_MS = 15_000;

export async function getModelSystemPrompt(modelId: string): Promise<string> {
  const cached = modelPromptCache.get(modelId);
  if (cached && Date.now() - cached.at < MODEL_PROMPT_TTL_MS) {
    return cached.text;
  }

  if (!initFirebaseAdmin()) {
    modelPromptCache.set(modelId, { text: '', at: Date.now() });
    return '';
  }

  try {
    const db = getDatabase();
    const snap = await db.ref(`config/modelPrompts/${modelId}`).get();
    const text =
      snap.exists() && typeof snap.val()?.text === 'string'
        ? String(snap.val().text).trim().slice(0, 8000)
        : '';
    modelPromptCache.set(modelId, { text, at: Date.now() });
    return text;
  } catch (err) {
    console.warn('getModelSystemPrompt failed', err);
    return cached?.text ?? '';
  }
}

type MaintenanceRow = {
  enabled?: boolean;
  reason?: string;
  until?: number | null;
  permanent?: boolean;
};

let maintenanceCache: { at: number; row: MaintenanceRow | null } = {
  at: 0,
  row: null,
};

function maintenanceActive(row: MaintenanceRow | null): boolean {
  if (!row?.enabled) return false;
  if (row.permanent) return true;
  if (row.until == null) return true;
  return Date.now() < row.until;
}

/** Блокировка чата при техработах (staff пропускаем). */
export async function getMaintenanceBlock(opts: {
  idToken: string | null;
}): Promise<{ blocked: boolean; reason: string }> {
  if (!initFirebaseAdmin()) {
    return { blocked: false, reason: '' };
  }

  try {
    if (Date.now() - maintenanceCache.at > 10_000) {
      const snap = await getDatabase().ref('config/maintenance').get();
      maintenanceCache = {
        at: Date.now(),
        row: snap.exists() ? (snap.val() as MaintenanceRow) : null,
      };
    }
    const row = maintenanceCache.row;
    if (!maintenanceActive(row)) {
      return { blocked: false, reason: '' };
    }

    if (opts.idToken) {
      try {
        const verified = await getAuth().verifyIdToken(opts.idToken);
        const userSnap = await getDatabase().ref(`users/${verified.uid}`).get();
        const user = (userSnap.val() || {}) as UserRow;
        const role = user.staffRole;
        if (
          role === 'helper' ||
          role === 'moderator' ||
          role === 'admin' ||
          role === 'owner' ||
          user.isAdmin === true ||
          user.admin === true
        ) {
          return { blocked: false, reason: '' };
        }
      } catch {
        /* treat as guest */
      }
    }

    return {
      blocked: true,
      reason:
        (typeof row?.reason === 'string' && row.reason.trim()) ||
        'Технические работы. Скоро вернёмся.',
    };
  } catch (err) {
    console.warn('getMaintenanceBlock failed', err);
    return { blocked: false, reason: '' };
  }
}
