/** Ошибки чат-API: понятное сообщение + техническая деталь для debug */

export type ChatApiErrorKind =
  | 'offline'
  | 'timeout'
  | 'server'
  | 'auth'
  | 'limit'
  | 'empty'
  | 'other';

export class ChatApiError extends Error {
  kind: ChatApiErrorKind;
  detail: string;
  status?: number;

  constructor(kind: ChatApiErrorKind, userMessage: string, detail: string, status?: number) {
    super(userMessage);
    this.name = 'ChatApiError';
    this.kind = kind;
    this.detail = detail;
    this.status = status;
  }
}

const OFFLINE_MSG =
  'Сервер временно недоступен. Проверьте интернет или попробуйте позже.';

export function isNetworkFailure(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const m = err.message.toLowerCase();
  const name = err.name;
  return (
    name === 'TypeError' ||
    name === 'AbortError' ||
    m.includes('failed to fetch') ||
    m.includes('networkerror') ||
    m.includes('network request failed') ||
    m.includes('load failed') ||
    m.includes('fetch')
  );
}

export function classifyHttpError(status: number, apiError?: string): ChatApiError {
  const detail = apiError?.trim() || `HTTP ${status}`;
  if (status === 401 || status === 403) {
    return new ChatApiError(
      'auth',
      'Нет доступа. Войдите в аккаунт или обновите страницу.',
      detail,
      status,
    );
  }
  if (status === 429) {
    return new ChatApiError(
      'limit',
      'Слишком много запросов. Подождите немного и попробуйте снова.',
      detail,
      status,
    );
  }
  if (status === 402 || /кредит|credit|лимит|limit/i.test(detail)) {
    return new ChatApiError(
      'limit',
      apiError?.trim() || 'Недостаточно кредитов для ответа.',
      detail,
      status,
    );
  }
  if (status >= 500 || status === 0) {
    return new ChatApiError('server', OFFLINE_MSG, detail, status);
  }
  return new ChatApiError(
    'other',
    apiError?.trim() || `Не удалось получить ответ (${status}).`,
    detail,
    status,
  );
}

export function wrapFetchError(err: unknown): ChatApiError {
  if (err instanceof ChatApiError) return err;
  if (err instanceof Error && err.name === 'AbortError') {
    return new ChatApiError('timeout', 'Запрос прерван. Попробуйте ещё раз.', err.message);
  }
  if (isNetworkFailure(err)) {
    const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return new ChatApiError('offline', OFFLINE_MSG, detail);
  }
  const detail = err instanceof Error ? err.message : String(err);
  return new ChatApiError('other', detail || 'Не удалось получить ответ.', detail);
}

export function formatChatFailure(err: unknown): { content: string; errorDetail: string } {
  const e = wrapFetchError(err);
  return { content: e.message, errorDetail: e.detail || e.message };
}
