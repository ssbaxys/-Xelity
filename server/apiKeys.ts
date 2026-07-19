/**
 * API-ключи Xelity + виртуальный USD-кошелёк (Admin SDK / RTDB).
 */
import { createHash, randomBytes } from 'crypto';
import { getDatabase } from 'firebase-admin/database';
import { API_STARTER_USD } from '../src/lib/apiPricing';

export type ApiKeyMeta = {
  id: string;
  prefix: string;
  name: string;
  createdAt: number;
  lastUsedAt?: number;
  revokedAt?: number | null;
};

export type ApiKeyAuth = {
  uid: string;
  keyId: string;
  prefix: string;
};

function pepper(): string {
  return process.env.XELITY_API_KEY_PEPPER || process.env.AITUNNEL_API_KEY || 'xelity-dev-pepper';
}

export function hashApiKey(raw: string): string {
  return createHash('sha256').update(`${pepper()}:${raw}`).digest('hex');
}

export function generateApiKey(): { raw: string; prefix: string; hash: string; id: string } {
  const id = randomBytes(8).toString('hex');
  const secret = randomBytes(24).toString('hex');
  const raw = `xel_${secret}`;
  const prefix = raw.slice(0, 12);
  return { raw, prefix, hash: hashApiKey(raw), id };
}

export async function ensureUsdWallet(uid: string): Promise<number> {
  const db = getDatabase();
  const ref = db.ref(`users/${uid}/billing`);
  const snap = await ref.get();
  const cur = snap.val() as { usdBalance?: number } | null;
  if (cur && typeof cur.usdBalance === 'number') return cur.usdBalance;
  await ref.update({
    usdBalance: API_STARTER_USD,
    currency: 'USD',
    updatedAt: Date.now(),
    starterGranted: true,
  });
  return API_STARTER_USD;
}

export async function getUsdBalance(uid: string): Promise<number> {
  return ensureUsdWallet(uid);
}

export async function chargeUsd(
  uid: string,
  amount: number,
  meta: { product: string; detail?: string },
): Promise<{ ok: true; balance: number } | { ok: false; error: string; balance: number }> {
  if (!(amount > 0)) return { ok: true, balance: await getUsdBalance(uid) };
  const db = getDatabase();
  const ref = db.ref(`users/${uid}/billing/usdBalance`);
  let result: { ok: true; balance: number } | { ok: false; error: string; balance: number } = {
    ok: false,
    error: 'Недостаточно средств',
    balance: 0,
  };

  await ref.transaction((curr) => {
    const bal = typeof curr === 'number' ? curr : 0;
    if (bal + 1e-9 < amount) {
      result = { ok: false, error: 'Недостаточно виртуальных USD', balance: bal };
      return; // abort
    }
    const next = Math.round((bal - amount) * 1e6) / 1e6;
    result = { ok: true, balance: next };
    return next;
  });

  if (result.ok) {
    const txId = `${Date.now().toString(36)}_${randomBytes(3).toString('hex')}`;
    await db.ref(`users/${uid}/billing/ledger/${txId}`).set({
      type: 'charge',
      amountUsd: amount,
      balanceAfter: result.balance,
      product: meta.product,
      detail: meta.detail || null,
      createdAt: Date.now(),
    });
    await db.ref(`users/${uid}/billing`).update({ updatedAt: Date.now() });
  }
  return result;
}

export async function createUserApiKey(
  uid: string,
  name: string,
): Promise<{ meta: ApiKeyMeta; raw: string }> {
  await ensureUsdWallet(uid);
  const { raw, prefix, hash, id } = generateApiKey();
  const meta: ApiKeyMeta = {
    id,
    prefix,
    name: (name || 'Default').trim().slice(0, 64) || 'Default',
    createdAt: Date.now(),
    revokedAt: null,
  };
  const db = getDatabase();
  await db.ref(`users/${uid}/apiKeys/${id}`).set({
    ...meta,
    hash,
  });
  await db.ref(`apiKeyIndex/${hash}`).set({ uid, keyId: id, prefix });
  return { meta, raw };
}

export async function listUserApiKeys(uid: string): Promise<ApiKeyMeta[]> {
  const snap = await getDatabase().ref(`users/${uid}/apiKeys`).get();
  const val = snap.val() as Record<string, ApiKeyMeta & { hash?: string }> | null;
  if (!val) return [];
  return Object.values(val)
    .map((k) => ({
      id: k.id,
      prefix: k.prefix,
      name: k.name,
      createdAt: k.createdAt,
      lastUsedAt: k.lastUsedAt,
      revokedAt: k.revokedAt ?? null,
    }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

export async function revokeUserApiKey(uid: string, keyId: string): Promise<boolean> {
  const db = getDatabase();
  const ref = db.ref(`users/${uid}/apiKeys/${keyId}`);
  const snap = await ref.get();
  if (!snap.exists()) return false;
  const row = snap.val() as { hash?: string };
  await ref.update({ revokedAt: Date.now() });
  if (row.hash) await db.ref(`apiKeyIndex/${row.hash}`).remove();
  return true;
}

export async function authenticateApiKey(raw: string): Promise<ApiKeyAuth | null> {
  const key = raw.trim();
  if (!key.startsWith('xel_') || key.length < 20) return null;
  const hash = hashApiKey(key);
  const db = getDatabase();
  const idx = await db.ref(`apiKeyIndex/${hash}`).get();
  if (!idx.exists()) return null;
  const { uid, keyId, prefix } = idx.val() as ApiKeyAuth;
  const metaSnap = await db.ref(`users/${uid}/apiKeys/${keyId}`).get();
  if (!metaSnap.exists()) return null;
  const meta = metaSnap.val() as { revokedAt?: number | null };
  if (meta.revokedAt) return null;
  void db.ref(`users/${uid}/apiKeys/${keyId}/lastUsedAt`).set(Date.now());
  return { uid, keyId, prefix };
}
