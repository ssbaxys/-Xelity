import { auth } from './firebase';
import type { ApiKeyMeta } from './apiTypes';

const apiBase =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') || '';

async function idToken(): Promise<string> {
  const t = await auth.currentUser?.getIdToken();
  if (!t) throw new Error('Войдите в аккаунт');
  return t;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = await idToken();
  const res = await fetch(`${apiBase}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers || {}),
    },
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error(
      typeof data === 'object' && data && 'error' in data && data.error
        ? String(data.error)
        : `HTTP ${res.status}`,
    );
  }
  return data;
}

export type AdminApiClientRow = {
  uid: string;
  email: string;
  name: string;
  usdBalance: number;
  formatted: string;
  apiFrozen: boolean;
  activeKeys: number;
  totalKeys: number;
  updatedAt: number | null;
};

export type AdminLedgerEntry = {
  id: string;
  type: string;
  amountUsd: number;
  balanceAfter: number;
  product?: string | null;
  detail?: string | null;
  createdAt: number;
  byAdmin?: string | null;
};

export type AdminApiUserBundle = {
  user: { uid: string; email: string; name: string };
  usdBalance: number;
  formatted: string;
  apiFrozen: boolean;
  updatedAt: number | null;
  ledger: AdminLedgerEntry[];
  keys: ApiKeyMeta[];
};

export function adminApiOverview() {
  return api<{ clients: AdminApiClientRow[] }>('/api/admin/api/overview');
}

export function adminApiLookup(q: string) {
  return api<AdminApiUserBundle>(`/api/admin/api/lookup?q=${encodeURIComponent(q)}`);
}

export function adminApiUser(uid: string) {
  return api<AdminApiUserBundle>(`/api/admin/api/user/${encodeURIComponent(uid)}`);
}

export function adminApiBalance(
  uid: string,
  body: { action: 'credit' | 'debit' | 'set'; amount: number; note?: string },
) {
  return api<{ ok: boolean; usdBalance: number; formatted: string }>(
    `/api/admin/api/user/${encodeURIComponent(uid)}/balance`,
    { method: 'POST', body: JSON.stringify(body) },
  );
}

export function adminApiFreeze(uid: string, frozen: boolean) {
  return api<{ ok: boolean; apiFrozen: boolean }>(
    `/api/admin/api/user/${encodeURIComponent(uid)}/freeze`,
    { method: 'POST', body: JSON.stringify({ frozen }) },
  );
}

export function adminApiCreateKey(uid: string, name: string) {
  return api<{ key: ApiKeyMeta; secret: string; warning: string }>(
    `/api/admin/api/user/${encodeURIComponent(uid)}/keys`,
    { method: 'POST', body: JSON.stringify({ name }) },
  );
}

export function adminApiRevokeKey(uid: string, keyId: string) {
  return api<{ ok: boolean }>(
    `/api/admin/api/user/${encodeURIComponent(uid)}/keys/${encodeURIComponent(keyId)}`,
    { method: 'DELETE' },
  );
}

export function adminApiRevokeAllKeys(uid: string) {
  return api<{ ok: boolean; revoked: number }>(
    `/api/admin/api/user/${encodeURIComponent(uid)}/keys/revoke-all`,
    { method: 'POST', body: '{}' },
  );
}
