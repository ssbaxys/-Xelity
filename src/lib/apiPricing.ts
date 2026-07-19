import { normalizeModelId, type ChatModelId } from './models';

/** Цены за 1_000_000 токенов (вход / выход), виртуальные USD */
export type TokenRates = { input: number; output: number };

export const API_USD = {
  /** $/1M tokens */
  chatPer1M: {
    'xlaude-mini-k1': { input: 0.4, output: 1.2 },
    'xlaude-pro-k1': { input: 0.8, output: 2.4 },
    'xlaude-mini-k2': { input: 1.6, output: 4.8 },
    'xlaude-pro-k2': { input: 3.2, output: 9.6 },
  } as Record<ChatModelId, TokenRates>,
  /** Удорожание выхода при reasoning */
  reasoningOutputMultiplier: 2,
  /** Фикс за вызов Search / Weather */
  search: 0.01,
  searchWithImages: 0.015,
  weather: 0.005,
} as const;

export function getChatRates(modelId: string): TokenRates {
  const id = normalizeModelId(modelId);
  return API_USD.chatPer1M[id] ?? API_USD.chatPer1M['xlaude-mini-k1'];
}

/** Оценка токенов по тексту (~4 символа ≈ 1 токен) */
export function estimateTokensFromText(text: string): number {
  const n = Math.ceil((text || '').length / 4);
  return Math.max(1, n);
}

export function chatUsdCostFromTokens(
  modelId: string,
  promptTokens: number,
  completionTokens: number,
  reasoning?: boolean,
): number {
  const rates = getChatRates(modelId);
  const pin = Math.max(0, promptTokens);
  const cout = Math.max(0, completionTokens);
  const outMul = reasoning ? API_USD.reasoningOutputMultiplier : 1;
  const cost =
    (pin / 1_000_000) * rates.input + (cout / 1_000_000) * rates.output * outMul;
  // внутренне до 6 знаков, в UI — $1.00
  return Math.round(cost * 1e6) / 1e6;
}

export function searchUsdCost(images?: boolean): number {
  return images ? API_USD.searchWithImages : API_USD.search;
}

export function weatherUsdCost(): number {
  return API_USD.weather;
}

/** Баланс и суммы для пользователя: $1.00 */
export function formatUsd(n: number): string {
  return `$${Number(n || 0).toFixed(2)}`;
}

/** Тарифы в кабинете: тоже в долларах с центами */
export function formatUsdRatePer1M(n: number): string {
  return `$${Number(n || 0).toFixed(2)} / 1M`;
}
