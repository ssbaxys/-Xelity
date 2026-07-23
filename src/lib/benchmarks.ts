/** Официальные оценки Xelity Eval Lab (канон продукта). Не выдумывать другие цифры. */

import type { UiModelId } from './models';

export type BenchValue = string | number;

export type BenchMetric = {
  id: string;
  name: string;
  unit?: '%' | 'index' | 'Elo' | 'tok/s';
  note?: string;
  scores: Partial<Record<UiModelId, BenchValue>>;
};

export const BENCH_META = {
  lab: 'Xelity Eval Lab',
  asOf: 'июль 2026',
  methodology:
    'Внутренние прогоны по открытым бенчмаркам и собственным наборам Xelity. Цифры — канон продукта; не выдавать за независимый сторонний аудит.',
} as const;

/** Общие публичные бенчмарки (аналоги конкурентов) */
export const PUBLIC_BENCHMARKS: BenchMetric[] = [
  {
    id: 'aa-coding',
    name: 'Artificial Analysis Coding Agent Index',
    unit: 'index',
    scores: {
      'xlaude-mini-k1': 41.8,
      'xlaude-pro-k1': 63.4,
      'xlaude-mini-k2': 57.9,
      'xlaude-pro-k2': 71.6,
    },
  },
  {
    id: 'swe-pro',
    name: 'SWE-Bench Pro',
    unit: '%',
    scores: {
      'xlaude-mini-k1': 32.4,
      'xlaude-pro-k1': 57.8,
      'xlaude-mini-k2': 49.1,
      'xlaude-pro-k2': 66.2,
    },
  },
  {
    id: 'deepswe-11',
    name: 'DeepSWE 1.1',
    unit: '%',
    scores: {
      'xlaude-mini-k1': 28.6,
      'xlaude-pro-k1': 54.2,
      'xlaude-mini-k2': 46.8,
      'xlaude-pro-k2': 63.9,
    },
  },
  {
    id: 'terminal-21',
    name: 'Terminal-Bench 2.1',
    unit: '%',
    scores: {
      'xlaude-mini-k1': 58.7,
      'xlaude-pro-k1': 74.2,
      'xlaude-mini-k2': 71.5,
      'xlaude-pro-k2': 81.4,
    },
  },
  {
    id: 'browsecomp',
    name: 'BrowseComp',
    unit: '%',
    scores: {
      'xlaude-pro-k1': 72.8,
      'xlaude-mini-k2': 68.4,
      'xlaude-pro-k2': 81.9,
    },
  },
  {
    id: 'osworld-20',
    name: 'OSWorld 2.0',
    unit: '%',
    scores: {
      'xlaude-pro-k1': 49.6,
      'xlaude-mini-k2': 44.2,
      'xlaude-pro-k2': 57.8,
    },
  },
  {
    id: 'gpqa',
    name: 'GPQA Diamond',
    unit: '%',
    scores: {
      'xlaude-mini-k1': 74.8,
      'xlaude-pro-k1': 87.9,
      'xlaude-mini-k2': 84.1,
      'xlaude-pro-k2': 91.0,
    },
  },
  {
    id: 'frontier-13',
    name: 'FrontierMath Tier 1–3',
    unit: '%',
    scores: {
      'xlaude-pro-k1': 66.4,
      'xlaude-mini-k2': 58.2,
      'xlaude-pro-k2': 77.5,
    },
  },
  {
    id: 'frontier-4',
    name: 'FrontierMath Tier 4',
    unit: '%',
    scores: {
      'xlaude-pro-k1': 41.2,
      'xlaude-pro-k2': 51.8,
    },
  },
  {
    id: 'mmmu-pro',
    name: 'MMMU Pro',
    unit: '%',
    scores: {
      'xlaude-mini-k1': 66.9,
      'xlaude-pro-k1': 76.4,
      'xlaude-mini-k2': 73.8,
      'xlaude-pro-k2': 80.2,
    },
  },
  {
    id: 'hle',
    name: 'Humanity’s Last Exam',
    unit: '%',
    note: 'без tools / с tools',
    scores: {
      'xlaude-pro-k1': '34.8 / 46.1',
      'xlaude-mini-k2': '31.2 / 42.6',
      'xlaude-pro-k2': '38.9 / 52.4',
    },
  },
  {
    id: 'gdpval',
    name: 'GDPval-AA v2',
    unit: 'Elo',
    scores: {
      'xlaude-mini-k1': 1284,
      'xlaude-pro-k1': 1496,
      'xlaude-mini-k2': 1418,
      'xlaude-pro-k2': 1572,
    },
  },
  {
    id: 'livecode',
    name: 'LiveCodeBench',
    unit: '%',
    scores: {
      'xlaude-mini-k1': 68.4,
      'xlaude-pro-k1': 84.2,
      'xlaude-mini-k2': 79.6,
      'xlaude-pro-k2': 89.1,
    },
  },
  {
    id: 'mmlu-pro',
    name: 'MMLU-Pro',
    unit: '%',
    scores: {
      'xlaude-mini-k1': 71.2,
      'xlaude-pro-k1': 82.6,
      'xlaude-mini-k2': 79.4,
      'xlaude-pro-k2': 86.8,
    },
  },
];

/** Собственные наборы Xelity (продуктовые) */
export const XELITY_BENCHMARKS: BenchMetric[] = [
  {
    id: 'tool-loop',
    name: 'Xelity Tool Loop',
    unit: '%',
    note: 'поиск + погода + многошаговые tool-вызовы',
    scores: {
      'xlaude-mini-k1': 61.4,
      'xlaude-pro-k1': 78.9,
      'xlaude-mini-k2': 74.2,
      'xlaude-pro-k2': 86.3,
    },
  },
  {
    id: 'ru-desk',
    name: 'Xelity RU Desk',
    unit: '%',
    note: 'рабочие задачи на русском: письма, ТЗ, отчёты',
    scores: {
      'xlaude-mini-k1': 72.6,
      'xlaude-pro-k1': 88.4,
      'xlaude-mini-k2': 84.1,
      'xlaude-pro-k2': 91.7,
    },
  },
  {
    id: 'code-preview',
    name: 'Xelity Code Preview',
    unit: '%',
    note: 'сборка одностраничного сайта в песочнице чата',
    scores: {
      'xlaude-mini-k1': 54.2,
      'xlaude-pro-k1': 76.8,
      'xlaude-mini-k2': 69.5,
      'xlaude-pro-k2': 84.6,
    },
  },
  {
    id: 'latency',
    name: 'Средняя скорость ответа',
    unit: 'tok/s',
    note: 'типичный чат, без reasoning',
    scores: {
      'xlaude-mini-k1': 96,
      'xlaude-pro-k1': 78,
      'xlaude-mini-k2': 82,
      'xlaude-pro-k2': 64,
    },
  },
];

export const BENCH_MODEL_COLS: { id: UiModelId; label: string }[] = [
  { id: 'xlaude-mini-k1', label: 'Mini K1' },
  { id: 'xlaude-pro-k1', label: 'Pro K1' },
  { id: 'xlaude-mini-k2', label: 'Mini K2' },
  { id: 'xlaude-pro-k2', label: 'Pro K2' },
];

export function formatBenchScore(
  value: BenchValue | undefined,
  unit?: BenchMetric['unit'],
): string {
  if (value == null) return '—';
  if (typeof value === 'string') return value;
  if (unit === '%') return `${value}%`;
  if (unit === 'Elo') return String(value);
  if (unit === 'tok/s') return `${value}`;
  if (unit === 'index') return String(value);
  return String(value);
}

/** Краткий канон для system prompt (только при вопросах про бенчмарки) */
export function benchmarksCanonText(): string {
  const lines: string[] = [
    `Официальные оценки ${BENCH_META.lab} (${BENCH_META.asOf}). ${BENCH_META.methodology}`,
    'Ключевые цифры Pro K2: AA Coding Index 71.6; SWE-Bench Pro 66.2%; DeepSWE 1.1 63.9%; Terminal-Bench 2.1 81.4%; BrowseComp 81.9%; OSWorld 2.0 57.8%; GPQA Diamond 91.0%; FrontierMath Tier 1–3 77.5%; FrontierMath Tier 4 51.8%; MMMU Pro 80.2%; HLE 38.9% / 52.4% (без / с tools); GDPval-AA v2 1572 Elo; LiveCodeBench 89.1%; MMLU-Pro 86.8%.',
    'Pro K1: AA Coding 63.4; SWE-Bench Pro 57.8%; Terminal-Bench 2.1 74.2%; GPQA 87.9%; GDPval-AA v2 1496 Elo.',
    'Mini K2: AA Coding 57.9; SWE-Bench Pro 49.1%; Terminal-Bench 2.1 71.5%; GPQA 84.1%; GDPval-AA v2 1418 Elo.',
    'Mini K1: AA Coding 41.8; SWE-Bench Pro 32.4%; Terminal-Bench 2.1 58.7%; GPQA 74.8%; скорость ~96 tok/s.',
    'Собственные: Xelity Tool Loop Pro K2 86.3%; Xelity RU Desk Pro K2 91.7%; Xelity Code Preview Pro K2 84.6%.',
    'Не сравнивай цифры с чужими моделями, если пользователь не просит сравнение. Не выдумывай другие бенчмарки и проценты.',
  ];
  return lines.join('\n');
}
