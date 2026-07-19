import { MODELS, type UiModelId } from './models';
import { requestXlaudeReply } from './xlaude';

const STOP_WORDS = new Set([
  'а',
  'и',
  'в',
  'на',
  'по',
  'с',
  'к',
  'у',
  'о',
  'из',
  'за',
  'от',
  'до',
  'не',
  'но',
  'что',
  'как',
  'это',
  'для',
  'или',
  'же',
  'бы',
  'ли',
  'то',
  'the',
  'a',
  'an',
  'to',
  'of',
  'in',
  'is',
  'it',
  'and',
  'or',
  'for',
  'with',
  'my',
  'me',
  'i',
  'you',
  'can',
  'could',
  'would',
  'write',
  'make',
  'create',
  'explain',
]);

export function isDefaultChatTitle(title: string) {
  return title === 'Новый чат' || /^Чат\s+\d+$/i.test(title);
}

/** Быстрый локальный заголовок, пока ИИ не ответил */
export function inventChatTitle(raw: string, modelId?: UiModelId | string | null): string {
  let text = raw
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]+`/g, ' ')
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/[#>*_~\[\](){}]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) {
    const fallback = MODELS.find((m) => m.id === modelId)?.name ?? 'Новый чат';
    return fallback;
  }

  const firstChunk = text.split(/[.!?\n]/)[0]?.trim() || text;
  const words = firstChunk
    .split(/\s+/)
    .map((w) => w.replace(/^[^0-9A-Za-zА-Яа-яЁё]+|[^0-9A-Za-zА-Яа-яЁё]+$/g, ''))
    .filter(Boolean);

  const meaningful = words.filter((w) => !STOP_WORDS.has(w.toLowerCase()));
  const picked = (meaningful.length >= 2 ? meaningful : words).slice(0, 6);

  let title = picked.join(' ').trim();
  if (!title) title = firstChunk.slice(0, 42).trim();
  title = title.charAt(0).toUpperCase() + title.slice(1);
  if (title.length > 48) title = `${title.slice(0, 45).trim()}…`;

  return title || 'Новый чат';
}

function sanitizeAiTitle(raw: string): string | null {
  let t = raw
    .replace(/^["'«»„“”]+|["'«»„“”]+$/g, '')
    .replace(/^заголовок\s*[:—-]\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t || /^новый\s+чат$/i.test(t)) return null;
  if (t.length > 56) t = `${t.slice(0, 53).trim()}…`;
  if (t.length < 2) return null;
  return t;
}

/** ИИ-заголовок по содержимому; при сбое — локальный fallback */
export async function generateChatTitle(params: {
  firstMessage: string;
  modelId?: UiModelId | string | null;
  signal?: AbortSignal;
}): Promise<string> {
  const fallback = inventChatTitle(params.firstMessage, params.modelId);
  const snippet = params.firstMessage.trim().slice(0, 600);
  if (!snippet) return fallback;

  try {
    const { content } = await requestXlaudeReply({
      modelId: 'xlaude-mini-k1',
      maxTokens: 48,
      skipCharge: true,
      webTools: false,
      codingTools: false,
      reasoning: false,
      signal: params.signal,
      systemExtra:
        'Ты называешь чаты. Ответь одной короткой фразой 3–7 слов на языке пользователя. Без кавычек, точек и пояснений.',
      messages: [
        {
          role: 'user',
          content: `Придумай заголовок чата по первому сообщению:\n\n${snippet}`,
        },
      ],
    });
    return sanitizeAiTitle(content) || fallback;
  } catch {
    return fallback;
  }
}
