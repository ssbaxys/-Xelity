/**
 * Кабинет API: ключи и баланс (Firebase ID token).
 */
import type { Request, Response } from 'express';
import { getAuth } from 'firebase-admin/auth';
import {
  createUserApiKey,
  ensureUsdWallet,
  getUsdBalance,
  listUserApiKeys,
  revokeUserApiKey,
} from './apiKeys';
import { API_USD, API_STARTER_USD, formatUsd } from '../src/lib/apiPricing';

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

async function requireUser(req: Request, res: Response): Promise<string | null> {
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
    return decoded.uid;
  } catch {
    res.status(401).json({ error: 'Неверный токен' });
    return null;
  }
}

export async function handleAccountBilling(req: Request, res: Response) {
  const uid = await requireUser(req, res);
  if (!uid) return;
  const balance = await ensureUsdWallet(uid);
  res.json({
    currency: 'USD',
    usdBalance: balance,
    starterUsd: API_STARTER_USD,
    pricing: {
      chat: API_USD.chat,
      reasoningMultiplier: API_USD.reasoningMultiplier,
      search: API_USD.search,
      searchWithImages: API_USD.searchWithImages,
      weather: API_USD.weather,
    },
    formatted: formatUsd(balance),
  });
}

export async function handleAccountKeysList(req: Request, res: Response) {
  const uid = await requireUser(req, res);
  if (!uid) return;
  const keys = await listUserApiKeys(uid);
  res.json({ keys });
}

export async function handleAccountKeysCreate(req: Request, res: Response) {
  const uid = await requireUser(req, res);
  if (!uid) return;
  const name = typeof req.body?.name === 'string' ? req.body.name : 'Default';
  const existing = await listUserApiKeys(uid);
  const active = existing.filter((k) => !k.revokedAt);
  if (active.length >= 5) {
    res.status(400).json({ error: 'Максимум 5 активных ключей' });
    return;
  }
  const { meta, raw } = await createUserApiKey(uid, name);
  res.status(201).json({
    key: meta,
    secret: raw,
    warning: 'Скопируйте ключ сейчас — повторно показать нельзя',
  });
}

export async function handleAccountKeysRevoke(req: Request, res: Response) {
  const uid = await requireUser(req, res);
  if (!uid) return;
  const keyId = String(req.params.keyId || '');
  if (!keyId) {
    res.status(400).json({ error: 'keyId обязателен' });
    return;
  }
  const ok = await revokeUserApiKey(uid, keyId);
  if (!ok) {
    res.status(404).json({ error: 'Ключ не найден' });
    return;
  }
  res.json({ ok: true });
}

export async function handleAccountBalance(req: Request, res: Response) {
  const uid = await requireUser(req, res);
  if (!uid) return;
  const bal = await getUsdBalance(uid);
  res.json({ usdBalance: bal, formatted: formatUsd(bal) });
}
