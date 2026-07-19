/**
 * API-ключи Xelity + виртуальный USD-кошелёк (Admin SDK / RTDB).
 */
import { createHash, randomBytes } from 'crypto';
import { getDatabase } from 'firebase-admin/database';

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

/** Кошелёк без стартового гранта — баланс 0, пока не пополнят. */
export async function ensureUsdWallet(uid: string): Promise<number> {
  const db = getDatabase();
  const ref = db.ref(`users/${uid}/billing`);
  const snap = await ref.get();
  const cur = snap.val() as { usdBalance?: number } | null;
  if (cur && typeof cur.usdBalance === 'number') return cur.usdBalance;
  await ref.update({
    usdBalance: 0,
    currency: 'USD',
    updatedAt: Date.now(),
    starterGranted: false,
  });
  return 0;
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
  // округление списания до цента для кошелька
  const bill = Math.round(amount * 100) / 100;
  if (!(bill > 0)) return { ok: true, balance: await getUsdBalance(uid) };

  const ref = db.ref(`users/${uid}/billing/usdBalance`);
  let result: { ok: true; balance: number } | { ok: false; error: string; balance: number } = {
    ok: false,
    error: 'Недостаточно средств',
    balance: 0,
  };

  await ref.transaction((curr) => {
    const bal = typeof curr === 'number' ? curr : 0;
    if (bal + 1e-9 < bill) {
      result = { ok: false, error: 'Недостаточно виртуальных USD', balance: bal };
      return; // abort
    }
    const next = Math.round((bal - bill) * 100) / 100;
    result = { ok: true, balance: next };
    return next;
  });

  if (result.ok) {
    const txId = `${Date.now().toString(36)}_${randomBytes(3).toString('hex')}`;
    await db.ref(`users/${uid}/billing/ledger/${txId}`).set({
      type: 'charge',
      amountUsd: bill,
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
  const billingSnap = await db.ref(`users/${uid}/billing`).get();
  const billing = billingSnap.val() as { apiFrozen?: boolean } | null;
  if (billing?.apiFrozen) return null;
  const metaSnap = await db.ref(`users/${uid}/apiKeys/${keyId}`).get();
  if (!metaSnap.exists()) return null;
  const meta = metaSnap.val() as { revokedAt?: number | null };
  if (meta.revokedAt) return null;
  void db.ref(`users/${uid}/apiKeys/${keyId}/lastUsedAt`).set(Date.now());
  return { uid, keyId, prefix };
}

export type LedgerEntry = {
  id: string;
  type: string;
  amountUsd: number;
  balanceAfter: number;
  product?: string | null;
  detail?: string | null;
  createdAt: number;
  byAdmin?: string | null;
};

export async function getBillingBundle(uid: string): Promise<{
  usdBalance: number;
  apiFrozen: boolean;
  updatedAt: number | null;
  ledger: LedgerEntry[];
  keys: ApiKeyMeta[];
}> {
  const db = getDatabase();
  await ensureUsdWallet(uid);
  const [billingSnap, keys] = await Promise.all([
    db.ref(`users/${uid}/billing`).get(),
    listUserApiKeys(uid),
  ]);
  const billing = billingSnap.val() as {
    usdBalance?: number;
    apiFrozen?: boolean;
    updatedAt?: number;
    ledger?: Record<string, Omit<LedgerEntry, 'id'>>;
  } | null;
  const ledger: LedgerEntry[] = billing?.ledger
    ? Object.entries(billing.ledger).map(([id, row]) => ({
        id,
        type: row.type,
        amountUsd: row.amountUsd,
        balanceAfter: row.balanceAfter,
        product: row.product ?? null,
        detail: row.detail ?? null,
        createdAt: row.createdAt,
        byAdmin: row.byAdmin ?? null,
      }))
    : [];
  ledger.sort((a, b) => b.createdAt - a.createdAt);
  return {
    usdBalance: typeof billing?.usdBalance === 'number' ? billing.usdBalance : 0,
    apiFrozen: billing?.apiFrozen === true,
    updatedAt: typeof billing?.updatedAt === 'number' ? billing.updatedAt : null,
    ledger: ledger.slice(0, 200),
    keys,
  };
}

async function writeLedger(
  uid: string,
  entry: {
    type: string;
    amountUsd: number;
    balanceAfter: number;
    product?: string;
    detail?: string;
    byAdmin?: string;
  },
) {
  const db = getDatabase();
  const txId = `${Date.now().toString(36)}_${randomBytes(3).toString('hex')}`;
  await db.ref(`users/${uid}/billing/ledger/${txId}`).set({
    type: entry.type,
    amountUsd: entry.amountUsd,
    balanceAfter: entry.balanceAfter,
    product: entry.product || null,
    detail: entry.detail || null,
    byAdmin: entry.byAdmin || null,
    createdAt: Date.now(),
  });
  await db.ref(`users/${uid}/billing`).update({ updatedAt: Date.now() });
}

/** Пополнение / списание / установка баланса (админ). */
export async function adjustUsdBalance(
  uid: string,
  opts: {
    action: 'credit' | 'debit' | 'set';
    amount: number;
    note?: string;
    byAdmin: string;
  },
): Promise<{ ok: true; balance: number } | { ok: false; error: string; balance: number }> {
  await ensureUsdWallet(uid);
  const amount = Math.round(Number(opts.amount) * 100) / 100;
  if (!Number.isFinite(amount)) {
    return { ok: false, error: 'Некорректная сумма', balance: await getUsdBalance(uid) };
  }
  if (opts.action !== 'set' && !(amount > 0)) {
    return { ok: false, error: 'Сумма должна быть > 0', balance: await getUsdBalance(uid) };
  }
  if (opts.action === 'set' && amount < 0) {
    return { ok: false, error: 'Баланс не может быть отрицательным', balance: await getUsdBalance(uid) };
  }

  const db = getDatabase();
  const ref = db.ref(`users/${uid}/billing/usdBalance`);
  let result: { ok: true; balance: number; delta: number; type: string } | {
    ok: false;
    error: string;
    balance: number;
  } = { ok: false, error: 'Ошибка транзакции', balance: 0 };

  await ref.transaction((curr) => {
    const bal = typeof curr === 'number' ? curr : 0;
    if (opts.action === 'credit') {
      const next = Math.round((bal + amount) * 100) / 100;
      result = { ok: true, balance: next, delta: amount, type: 'credit' };
      return next;
    }
    if (opts.action === 'debit') {
      if (bal + 1e-9 < amount) {
        result = { ok: false, error: 'Недостаточно средств для списания', balance: bal };
        return;
      }
      const next = Math.round((bal - amount) * 100) / 100;
      result = { ok: true, balance: next, delta: -amount, type: 'debit' };
      return next;
    }
    const next = Math.round(amount * 100) / 100;
    result = {
      ok: true,
      balance: next,
      delta: Math.round((next - bal) * 100) / 100,
      type: 'set',
    };
    return next;
  });

  if (result.ok) {
    await writeLedger(uid, {
      type: result.type,
      amountUsd: Math.abs(result.delta),
      balanceAfter: result.balance,
      product: 'admin',
      detail: opts.note?.trim().slice(0, 200) || `${opts.action} ${amount}`,
      byAdmin: opts.byAdmin,
    });
  }
  return result.ok
    ? { ok: true, balance: result.balance }
    : { ok: false, error: result.error, balance: result.balance };
}

export async function setApiFrozen(
  uid: string,
  frozen: boolean,
  byAdmin: string,
): Promise<boolean> {
  await ensureUsdWallet(uid);
  const db = getDatabase();
  await db.ref(`users/${uid}/billing`).update({
    apiFrozen: frozen,
    updatedAt: Date.now(),
  });
  await writeLedger(uid, {
    type: frozen ? 'freeze' : 'unfreeze',
    amountUsd: 0,
    balanceAfter: await getUsdBalance(uid),
    product: 'admin',
    detail: frozen ? 'API заморожен' : 'API разморожен',
    byAdmin,
  });
  return true;
}

export async function revokeAllUserApiKeys(uid: string): Promise<number> {
  const keys = await listUserApiKeys(uid);
  let n = 0;
  for (const k of keys) {
    if (!k.revokedAt) {
      const ok = await revokeUserApiKey(uid, k.id);
      if (ok) n += 1;
    }
  }
  return n;
}

export type ApiClientRow = {
  uid: string;
  email: string;
  name: string;
  usdBalance: number;
  apiFrozen: boolean;
  activeKeys: number;
  totalKeys: number;
  updatedAt: number | null;
};

/** Клиенты с ключами или ненулевым балансом / заморозкой. */
export async function listApiClients(limit = 80): Promise<ApiClientRow[]> {
  const db = getDatabase();
  const snap = await db.ref('users').get();
  const users = snap.val() as Record<
    string,
    {
      email?: string;
      name?: string;
      billing?: { usdBalance?: number; apiFrozen?: boolean; updatedAt?: number };
      apiKeys?: Record<string, { revokedAt?: number | null }>;
    }
  > | null;
  if (!users) return [];
  const rows: ApiClientRow[] = [];
  for (const [uid, u] of Object.entries(users)) {
    const keys = u.apiKeys ? Object.values(u.apiKeys) : [];
    const activeKeys = keys.filter((k) => !k.revokedAt).length;
    const bal = typeof u.billing?.usdBalance === 'number' ? u.billing.usdBalance : 0;
    const frozen = u.billing?.apiFrozen === true;
    if (!keys.length && bal === 0 && !frozen) continue;
    rows.push({
      uid,
      email: u.email || '',
      name: u.name || '',
      usdBalance: bal,
      apiFrozen: frozen,
      activeKeys,
      totalKeys: keys.length,
      updatedAt: typeof u.billing?.updatedAt === 'number' ? u.billing.updatedAt : null,
    });
  }
  rows.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  return rows.slice(0, limit);
}

export async function lookupUserByQuery(q: string): Promise<{
  uid: string;
  email: string;
  name: string;
} | null> {
  const query = q.trim();
  if (!query) return null;
  const db = getDatabase();
  if (query.length >= 20 && !query.includes('@')) {
    const snap = await db.ref(`users/${query}`).get();
    if (snap.exists()) {
      const u = snap.val() as { email?: string; name?: string };
      return { uid: query, email: u.email || '', name: u.name || '' };
    }
  }
  const all = await db.ref('users').get();
  const users = all.val() as Record<string, { email?: string; name?: string }> | null;
  if (!users) return null;
  const lower = query.toLowerCase();
  for (const [uid, u] of Object.entries(users)) {
    if (uid === query) return { uid, email: u.email || '', name: u.name || '' };
    if ((u.email || '').toLowerCase() === lower) {
      return { uid, email: u.email || '', name: u.name || '' };
    }
  }
  for (const [uid, u] of Object.entries(users)) {
    if ((u.email || '').toLowerCase().includes(lower) || (u.name || '').toLowerCase().includes(lower)) {
      return { uid, email: u.email || '', name: u.name || '' };
    }
  }
  return null;
}
