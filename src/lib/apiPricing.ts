import { normalizeModelId, type ChatModelId } from './models';

/** Виртуальные USD за запросы публичного API Xelity */
export const API_STARTER_USD = 1;

export const API_USD = {
  chat: {
    'xlaude-mini-k1': 0.002,
    'xlaude-pro-k1': 0.004,
    'xlaude-mini-k2': 0.008,
    'xlaude-pro-k2': 0.016,
  } as Record<ChatModelId, number>,
  reasoningMultiplier: 2,
  /** Xelity Search */
  search: 0.001,
  searchWithImages: 0.0015,
  /** Xelity Weather */
  weather: 0.0005,
} as const;

export function chatUsdCost(modelId: string, reasoning?: boolean): number {
  const id = normalizeModelId(modelId);
  const base = API_USD.chat[id] ?? API_USD.chat['xlaude-mini-k1'];
  return reasoning ? base * API_USD.reasoningMultiplier : base;
}

export function searchUsdCost(images?: boolean): number {
  return images ? API_USD.searchWithImages : API_USD.search;
}

export function weatherUsdCost(): number {
  return API_USD.weather;
}

export function formatUsd(n: number): string {
  return `$${n.toFixed(4)}`;
}
