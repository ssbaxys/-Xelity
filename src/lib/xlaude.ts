/**
 * Клиентский API к бэкенду.
 * Промпты, кредиты, бан/мут, тариф — только на VPS.
 */
import { auth } from './firebase';
import { getModel, normalizeModelId, type UiModelId } from './models';

export type { UiModelId } from './models';
export { isUiModelId, normalizeModelId, getModel } from './models';

export type ReasoningPhase = 'think' | 'answer';

export type ChatApiMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export type ChatUsageInfo = {
  used: number;
  limit: number | null;
  cost: number;
  planId: string;
};

export async function requestXlaudeReply(params: {
  modelId: UiModelId | string;
  messages: ChatApiMessage[];
  maxTokens?: number;
  signal?: AbortSignal;
  systemExtra?: string | null;
  reasoningPhase?: ReasoningPhase;
  reasoning?: boolean;
}): Promise<{ content: string; usage?: ChatUsageInfo }> {
  const modelId = normalizeModelId(params.modelId);
  const apiBase =
    (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') || '';

  let idToken: string | undefined;
  try {
    idToken = (await auth.currentUser?.getIdToken()) || undefined;
  } catch {
    idToken = undefined;
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (idToken) headers.Authorization = `Bearer ${idToken}`;

  const res = await fetch(`${apiBase}/api/chat`, {
    method: 'POST',
    headers,
    keepalive: true,
    signal: params.signal,
    body: JSON.stringify({
      modelId,
      messages: params.messages,
      // maxTokens игнорируется сервером по тарифу — поле оставлено для совместимости
      maxTokens: params.maxTokens ?? getModel(modelId).defaultMaxTokens,
      systemExtra: params.systemExtra ? String(params.systemExtra).slice(0, 2000) : undefined,
      reasoningPhase: params.reasoningPhase,
      reasoning: params.reasoning === true,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    content?: string;
    error?: string;
    usage?: ChatUsageInfo;
  };

  if (!res.ok) {
    throw new Error(data.error || `Ошибка API (${res.status})`);
  }

  const content = data.content?.trim();
  if (!content) throw new Error('Пустой ответ модели');
  return { content, usage: data.usage };
}
