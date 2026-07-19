/**
 * Клиентский API к бэкенду.
 * Промпты, кредиты, бан/мут, тариф — только на VPS.
 */
import { auth } from './firebase';
import { classifyHttpError, wrapFetchError } from './chatApiError';
import { getModel, normalizeModelId, type UiModelId } from './models';

export type { UiModelId } from './models';
export { isUiModelId, normalizeModelId, getModel } from './models';

export type ReasoningPhase = 'think' | 'answer';

export type ToolCall = {
  id: string;
  type?: string;
  function: { name: string; arguments: string };
};

export type ChatApiMessage = {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_call_id?: string;
  name?: string;
  tool_calls?: ToolCall[];
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
  codingTools?: boolean;
  webTools?: boolean;
  skipCharge?: boolean;
}): Promise<{ content: string; tool_calls?: ToolCall[]; usage?: ChatUsageInfo }> {
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

  let res: Response;
  try {
    res = await fetch(`${apiBase}/api/chat`, {
      method: 'POST',
      headers,
      keepalive: true,
      signal: params.signal,
      body: JSON.stringify({
        modelId,
        messages: params.messages,
        maxTokens: params.maxTokens ?? getModel(modelId).defaultMaxTokens,
        systemExtra: params.systemExtra ? String(params.systemExtra).slice(0, 2000) : undefined,
        reasoningPhase: params.reasoningPhase,
        reasoning: params.reasoning === true,
        codingTools: params.codingTools === true,
        webTools: params.webTools !== false,
        skipCharge: params.skipCharge === true,
      }),
    });
  } catch (err) {
    throw wrapFetchError(err);
  }

  const data = (await res.json().catch(() => ({}))) as {
    content?: string;
    tool_calls?: ToolCall[];
    error?: string;
    usage?: ChatUsageInfo;
  };

  if (!res.ok) {
    throw classifyHttpError(res.status, data.error);
  }

  const toolCalls = Array.isArray(data.tool_calls) ? data.tool_calls : [];
  const content = (data.content || '').trim();
  if (!content && !toolCalls.length) {
    throw classifyHttpError(502, 'Пустой ответ модели');
  }
  return { content, tool_calls: toolCalls.length ? toolCalls : undefined, usage: data.usage };
}
