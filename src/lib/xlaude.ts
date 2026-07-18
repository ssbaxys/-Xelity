/**
 * Клиентский API к бэкенду.
 * Промпты, HARDENING и upstream model id — только на сервере (server/prompts.ts).
 */
import { getModel, normalizeModelId, type UiModelId } from './models';

export type { UiModelId } from './models';
export { isUiModelId, normalizeModelId, getModel } from './models';

export type ReasoningPhase = 'think' | 'answer';

export type ChatApiMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
};

export async function requestXlaudeReply(params: {
  modelId: UiModelId | string;
  messages: ChatApiMessage[];
  maxTokens?: number;
  signal?: AbortSignal;
  systemExtra?: string | null;
  reasoningPhase?: ReasoningPhase;
}): Promise<string> {
  const modelId = normalizeModelId(params.modelId);
  const apiBase =
    (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') || '';
  const res = await fetch(`${apiBase}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    keepalive: true,
    signal: params.signal,
    body: JSON.stringify({
      modelId,
      messages: params.messages,
      maxTokens: params.maxTokens ?? getModel(modelId).defaultMaxTokens,
      // systemExtra — короткий контекст чата; systemOverride с клиента запрещён
      systemExtra: params.systemExtra ? String(params.systemExtra).slice(0, 2000) : undefined,
      reasoningPhase: params.reasoningPhase,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    content?: string;
    error?: string;
  };

  if (!res.ok) {
    throw new Error(data.error || `Ошибка API (${res.status})`);
  }

  const content = data.content?.trim();
  if (!content) throw new Error('Пустой ответ модели');
  return content;
}
