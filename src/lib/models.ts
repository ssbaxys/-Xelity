/** Линейка Xlaude K1 / K2 */

export type UiModelId =
  | 'xlaude-mini-k1'
  | 'xlaude-pro-k1'
  | 'xlaude-mini-k2'
  | 'xlaude-pro-k2';
export type ChatModelId = UiModelId;

export type ModelDef = {
  id: UiModelId;
  name: string;
  tab: string;
  /** Короткая подпись в селекторе чата */
  desc: string;
  /** Развёрнутое описание на лендинге */
  blurb: string;
  generation: 'K1' | 'K2';
  /** стоимость одного ответа в кредитах */
  creditCost: number;
  /** макс. токены ответа по умолчанию (если план не выше) */
  defaultMaxTokens: number;
  temperature: number;
};

export const MODELS: ModelDef[] = [
  {
    id: 'xlaude-mini-k1',
    name: 'Xlaude Mini K1',
    tab: 'Mini K1',
    desc: 'Быстрые ответы · 1 кр.',
    blurb:
      'Для повседневных задач: короткие ответы, черновики и быстрые вопросы без лишней нагрузки на лимит.',
    generation: 'K1',
    creditCost: 1,
    defaultMaxTokens: 1024,
    temperature: 0.35,
  },
  {
    id: 'xlaude-pro-k1',
    name: 'Xlaude Pro K1',
    tab: 'Pro K1',
    desc: 'Документы и код · 2 кр.',
    blurb:
      'Деловой тон и структура: документы, код, разбор задач — когда нужен аккуратный рабочий результат.',
    generation: 'K1',
    creditCost: 2,
    defaultMaxTokens: 4096,
    temperature: 0.3,
  },
  {
    id: 'xlaude-mini-k2',
    name: 'Xlaude Mini K2',
    tab: 'Mini K2',
    desc: 'Сильнее контекст · 4 кр.',
    blurb:
      'Следующее поколение Mini: лучше держит длинный контекст, яснее структура и разбор сложных запросов.',
    generation: 'K2',
    creditCost: 4,
    defaultMaxTokens: 8192,
    temperature: 0.45,
  },
  {
    id: 'xlaude-pro-k2',
    name: 'Xlaude Pro K2',
    tab: 'Pro K2',
    desc: 'Глубина и код · 8 кр.',
    blurb:
      'Про-линейка K2: длинные документы, архитектура, стратегия и сложный код — максимум глубины в чате.',
    generation: 'K2',
    creditCost: 8,
    defaultMaxTokens: 12288,
    temperature: 0.28,
  },
];

export const MODEL_ORDER: UiModelId[] = MODELS.map((m) => m.id);

export const DEFAULT_MODEL_ID: UiModelId = 'xlaude-mini-k1';

const BY_ID: Record<string, ModelDef> = Object.fromEntries(MODELS.map((m) => [m.id, m]));

/** Старые id → новые */
const LEGACY_MODEL_MAP: Record<string, UiModelId> = {
  'xlaude-mini-1': 'xlaude-mini-k1',
  'xlaude-mini-1-code': 'xlaude-pro-k1',
  'xlaude-mini-1-research': 'xlaude-mini-k2',
};

export function isUiModelId(value: string | null | undefined): value is UiModelId {
  return (
    value === 'xlaude-mini-k1' ||
    value === 'xlaude-pro-k1' ||
    value === 'xlaude-mini-k2' ||
    value === 'xlaude-pro-k2'
  );
}

export function normalizeModelId(value: string | null | undefined): UiModelId {
  if (!value) return DEFAULT_MODEL_ID;
  if (isUiModelId(value)) return value;
  if (LEGACY_MODEL_MAP[value]) return LEGACY_MODEL_MAP[value];
  return DEFAULT_MODEL_ID;
}

export function getModel(id: string | null | undefined): ModelDef {
  const nid = normalizeModelId(id);
  return BY_ID[nid] ?? BY_ID[DEFAULT_MODEL_ID];
}

export function creditCostForModel(id: string | null | undefined): number {
  return getModel(id).creditCost;
}

/** Режим «Рассуждения» списывает кредиты ×2 (два шага генерации) */
export function creditCostForRequest(
  id: string | null | undefined,
  reasoning?: boolean | null,
): number {
  const base = creditCostForModel(id);
  return reasoning ? base * 2 : base;
}

export function modelLabel(id: string | null | undefined): string {
  return getModel(id).tab;
}

export function modelDisplayName(id: string | null | undefined): string {
  return getModel(id).name;
}
