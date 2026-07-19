/**
 * Админ: управление клиентским API (баланс USD, ключи, freeze).
 */
import type { Request, Response } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { getDatabase } from 'firebase-admin/database';
import {
  adjustUsdBalance,
  createUserApiKey,
  getBillingBundle,
  listApiClients,
  listUserApiKeys,
  lookupUserByQuery,
  revokeAllUserApiKeys,
  revokeUserApiKey,
  setApiFrozen,
} from './apiKeys';
import { formatUsd } from '../src/lib/apiPricing';

function cors(req: Request, res: Response) {
  const raw = process.env.CORS_ORIGIN || '*';
  const allowed = raw.split(',').map((s) => s.trim()).filter(Boolean);
  const origin = req.headers.origin;
  if (allowed.includes('*')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else if (origin && allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function requireApiAdmin(
  req: Request,
  res: Response,
): Promise<{ uid: string; role: string } | null> {
  cors(req, res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return null;
  }
  const h = req.headers.authorization || '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  if (!m) {
    res.status(401).json({ error: 'Нужен Firebase ID token' });
    return null;
  }
  try {
    const decoded = await getAuth().verifyIdToken(m[1].trim());
    const snap = await getDatabase().ref(`users/${decoded.uid}`).get();
    const user = snap.val() as { staffRole?: string | null } | null;
    const role = user?.staffRole;
    if (role !== 'admin' && role !== 'owner') {
      res.status(403).json({ error: 'Нужна роль admin или owner' });
      return null;
    }
    return { uid: decoded.uid, role };
  } catch {
    res.status(401).json({ error: 'Неверный токен' });
    return null;
  }
}

export async function handleAdminApiOverview(req: Request, res: Response) {
  const staff = await requireApiAdmin(req, res);
  if (!staff) return;
  const clients = await listApiClients(100);
  res.json({
    clients: clients.map((c) => ({
      ...c,
      formatted: formatUsd(c.usdBalance),
    })),
  });
}

export async function handleAdminApiLookup(req: Request, res: Response) {
  const staff = await requireApiAdmin(req, res);
  if (!staff) return;
  const q = String(req.query.q || '').trim();
  if (!q) {
    res.status(400).json({ error: 'q обязателен' });
    return;
  }
  const found = await lookupUserByQuery(q);
  if (!found) {
    res.status(404).json({ error: 'Пользователь не найден' });
    return;
  }
  const bundle = await getBillingBundle(found.uid);
  res.json({
    user: found,
    ...bundle,
    formatted: formatUsd(bundle.usdBalance),
  });
}

export async function handleAdminApiUserGet(req: Request, res: Response) {
  const staff = await requireApiAdmin(req, res);
  if (!staff) return;
  const uid = String(req.params.uid || '').trim();
  if (!uid) {
    res.status(400).json({ error: 'uid обязателен' });
    return;
  }
  const snap = await getDatabase().ref(`users/${uid}`).get();
  if (!snap.exists()) {
    res.status(404).json({ error: 'Пользователь не найден' });
    return;
  }
  const u = snap.val() as { email?: string; name?: string };
  const bundle = await getBillingBundle(uid);
  res.json({
    user: { uid, email: u.email || '', name: u.name || '' },
    ...bundle,
    formatted: formatUsd(bundle.usdBalance),
  });
}

export async function handleAdminApiBalance(req: Request, res: Response) {
  const staff = await requireApiAdmin(req, res);
  if (!staff) return;
  const uid = String(req.params.uid || '').trim();
  const action = String(req.body?.action || '').trim() as 'credit' | 'debit' | 'set';
  const amount = Number(req.body?.amount);
  const note = typeof req.body?.note === 'string' ? req.body.note : undefined;
  if (!uid || !['credit', 'debit', 'set'].includes(action)) {
    res.status(400).json({ error: 'uid + action (credit|debit|set) обязательны' });
    return;
  }
  const result = await adjustUsdBalance(uid, {
    action,
    amount,
    note,
    byAdmin: staff.uid,
  });
  if (!result.ok) {
    res.status(400).json({ error: result.error, balance: result.balance });
    return;
  }
  res.json({
    ok: true,
    usdBalance: result.balance,
    formatted: formatUsd(result.balance),
  });
}

export async function handleAdminApiFreeze(req: Request, res: Response) {
  const staff = await requireApiAdmin(req, res);
  if (!staff) return;
  const uid = String(req.params.uid || '').trim();
  const frozen = req.body?.frozen === true;
  if (!uid) {
    res.status(400).json({ error: 'uid обязателен' });
    return;
  }
  await setApiFrozen(uid, frozen, staff.uid);
  res.json({ ok: true, apiFrozen: frozen });
}

export async function handleAdminApiKeysCreate(req: Request, res: Response) {
  const staff = await requireApiAdmin(req, res);
  if (!staff) return;
  const uid = String(req.params.uid || '').trim();
  const name = typeof req.body?.name === 'string' ? req.body.name : 'Admin-issued';
  if (!uid) {
    res.status(400).json({ error: 'uid обязателен' });
    return;
  }
  const existing = await listUserApiKeys(uid);
  const active = existing.filter((k) => !k.revokedAt);
  if (active.length >= 10) {
    res.status(400).json({ error: 'Максимум 10 активных ключей' });
    return;
  }
  const { meta, raw } = await createUserApiKey(uid, name);
  res.status(201).json({
    key: meta,
    secret: raw,
    warning: 'Скопируйте ключ — повторно не покажем',
    issuedBy: staff.uid,
  });
}

export async function handleAdminApiKeysRevoke(req: Request, res: Response) {
  const staff = await requireApiAdmin(req, res);
  if (!staff) return;
  const uid = String(req.params.uid || '').trim();
  const keyId = String(req.params.keyId || '').trim();
  if (!uid || !keyId) {
    res.status(400).json({ error: 'uid и keyId обязательны' });
    return;
  }
  const ok = await revokeUserApiKey(uid, keyId);
  if (!ok) {
    res.status(404).json({ error: 'Ключ не найден' });
    return;
  }
  res.json({ ok: true, revokedBy: staff.uid });
}

export async function handleAdminApiKeysRevokeAll(req: Request, res: Response) {
  const staff = await requireApiAdmin(req, res);
  if (!staff) return;
  const uid = String(req.params.uid || '').trim();
  if (!uid) {
    res.status(400).json({ error: 'uid обязателен' });
    return;
  }
  const n = await revokeAllUserApiKeys(uid);
  res.json({ ok: true, revoked: n, revokedBy: staff.uid });
}
