import { auth } from './firebase';
import type { ApiKeyMeta } from './apiTypes';
import type { TokenRates } from './apiPricing';

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

export type BillingInfo = {
  currency: string;
  usdBalance: number;
  formatted: string;
  pricing: {
    chatPer1M: Record<string, TokenRates>;
    reasoningOutputMultiplier: number;
    search: number;
    searchWithImages: number;
    weather: number;
  };
};

export function fetchBilling() {
  return api<BillingInfo>('/api/account/billing');
}

export function fetchApiKeys() {
  return api<{ keys: ApiKeyMeta[] }>('/api/account/keys');
}

export function createApiKey(name: string) {
  return api<{ key: ApiKeyMeta; secret: string; warning: string }>('/api/account/keys', {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function revokeApiKey(keyId: string) {
  return api<{ ok: boolean }>(`/api/account/keys/${encodeURIComponent(keyId)}`, {
    method: 'DELETE',
  });
}
