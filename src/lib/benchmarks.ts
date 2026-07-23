/**
 * Официальные оценки Xelity Eval Lab (канон продукта).
 * Якорь: класс dense ~31B (июль 2026) — без раздувания до frontier-топов.
 * SKU Mini/Pro K1/K2 делят один класс модели; разница — промпт, max tokens, reasoning, tools.
 */

import type { UiModelId } from './models';

export type BenchValue = string | number;

export type BenchMetric = {
  id: string;
  name: string;
  unit?: '%' | 'index' | 'Elo' | 'tok/s' | 'score';
  note?: string;
  scores: Partial<Record<UiModelId, BenchValue>>;
};

export const BENCH_META = {
  lab: 'Xelity Eval Lab',
  asOf: 'июль 2026',
  methodology:
    'Оценки для линейки Xlaude в классе dense ~31B параметров (контекст до 256K). Внутренние прогоны и публичные цифры того же класса; не независимый сторонний аудит и не сравнение с frontier Ultra/Opus. Разница Mini/Pro — в основном настройки продукта (длина ответа, reasoning, tools), а не «другая сверхмодель».',
} as const;

/** Публичные бенчмарки — якорь ≈ published dense-31B (Gemma 4 31B class) */
export const PUBLIC_BENCHMARKS: BenchMetric[] = [
  {
    id: 'aa-intel',
    name: 'Artificial Analysis Intelligence Index v4.1',
    unit: 'score',
    note: 'место ~28 из ~580 моделей того же среза',
    scores: {
      'xlaude-mini-k1': 27,
      'xlaude-pro-k1': 28,
      'xlaude-mini-k2': 28,
      'xlaude-pro-k2': 29,
    },
  },
  {
    id: 'arena',
    name: 'Arena AI Text',
    unit: 'Elo',
    note: 'срез на 2 апреля 2026',
    scores: {
      'xlaude-mini-k1': 1428,
      'xlaude-pro-k1': 1444,
      'xlaude-mini-k2': 1440,
      'xlaude-pro-k2': 1452,
    },
  },
  {
    id: 'mmlu-pro',
    name: 'MMLU-Pro',
    unit: '%',
    scores: {
      'xlaude-mini-k1': 82.6,
      'xlaude-pro-k1': 84.4,
      'xlaude-mini-k2': 84.1,
      'xlaude-pro-k2': 85.2,
    },
  },
  {
    id: 'mmmlu',
    name: 'MMMLU',
    unit: '%',
    scores: {
      'xlaude-mini-k1': 85.9,
      'xlaude-pro-k1': 87.6,
      'xlaude-mini-k2': 87.2,
      'xlaude-pro-k2': 88.4,
    },
  },
  {
    id: 'gpqa',
    name: 'GPQA Diamond',
    unit: '%',
    scores: {
      'xlaude-mini-k1': 81.2,
      'xlaude-pro-k1': 83.4,
      'xlaude-mini-k2': 83.0,
      'xlaude-pro-k2': 84.3,
    },
  },
  {
    id: 'aime-2026',
    name: 'AIME 2026',
    unit: '%',
    note: 'без инструментов',
    scores: {
      'xlaude-mini-k1': 84.8,
      'xlaude-pro-k1': 87.6,
      'xlaude-mini-k2': 87.1,
      'xlaude-pro-k2': 89.2,
    },
  },
  {
    id: 'livecode-v6',
    name: 'LiveCodeBench v6',
    unit: '%',
    scores: {
      'xlaude-mini-k1': 74.8,
      'xlaude-pro-k1': 78.6,
      'xlaude-mini-k2': 77.9,
      'xlaude-pro-k2': 80.0,
    },
  },
  {
    id: 'codeforces',
    name: 'Codeforces',
    unit: 'Elo',
    scores: {
      'xlaude-mini-k1': 1980,
      'xlaude-pro-k1': 2090,
      'xlaude-mini-k2': 2065,
      'xlaude-pro-k2': 2150,
    },
  },
  {
    id: 'tau2',
    name: 'τ²-bench (среднее)',
    unit: '%',
    scores: {
      'xlaude-mini-k1': 71.4,
      'xlaude-pro-k1': 75.2,
      'xlaude-mini-k2': 74.6,
      'xlaude-pro-k2': 76.9,
    },
  },
  {
    id: 'tau2-retail',
    name: 'τ²-bench Retail',
    unit: '%',
    scores: {
      'xlaude-mini-k1': 81.2,
      'xlaude-pro-k1': 84.8,
      'xlaude-mini-k2': 84.1,
      'xlaude-pro-k2': 86.4,
    },
  },
  {
    id: 'hle',
    name: 'Humanity’s Last Exam',
    unit: '%',
    note: 'без tools / с поиском',
    scores: {
      'xlaude-mini-k1': '17.8 / 23.4',
      'xlaude-pro-k1': '18.9 / 25.2',
      'xlaude-mini-k2': '18.6 / 24.8',
      'xlaude-pro-k2': '19.5 / 26.5',
    },
  },
  {
    id: 'bbeh',
    name: 'BigBench Extra Hard',
    unit: '%',
    scores: {
      'xlaude-mini-k1': 70.8,
      'xlaude-pro-k1': 73.2,
      'xlaude-mini-k2': 72.8,
      'xlaude-pro-k2': 74.4,
    },
  },
  {
    id: 'mmmu-pro',
    name: 'MMMU Pro',
    unit: '%',
    scores: {
      'xlaude-mini-k1': 73.4,
      'xlaude-pro-k1': 75.8,
      'xlaude-mini-k2': 75.2,
      'xlaude-pro-k2': 76.9,
    },
  },
  {
    id: 'math-vision',
    name: 'MATH-Vision',
    unit: '%',
    scores: {
      'xlaude-mini-k1': 81.9,
      'xlaude-pro-k1': 84.4,
      'xlaude-mini-k2': 83.8,
      'xlaude-pro-k2': 85.6,
    },
  },
  {
    id: 'medxpert',
    name: 'MedXPertQA Multimodal',
    unit: '%',
    scores: {
      'xlaude-mini-k1': 57.2,
      'xlaude-pro-k1': 59.8,
      'xlaude-mini-k2': 59.1,
      'xlaude-pro-k2': 61.3,
    },
  },
  {
    id: 'omnidoc',
    name: 'OmniDocBench 1.5',
    unit: 'score',
    note: 'меньше — лучше',
    scores: {
      'xlaude-mini-k1': 0.148,
      'xlaude-pro-k1': 0.136,
      'xlaude-mini-k2': 0.139,
      'xlaude-pro-k2': 0.131,
    },
  },
  {
    id: 'mrcr',
    name: 'MRCR v2 (8 needles, 128K)',
    unit: '%',
    scores: {
      'xlaude-mini-k1': 61.8,
      'xlaude-pro-k1': 64.9,
      'xlaude-mini-k2': 64.2,
      'xlaude-pro-k2': 66.4,
    },
  },
  {
    id: 'swe-pro',
    name: 'SWE-Bench Pro',
    unit: '%',
    note: 'оценка класса ~31B, не frontier Ultra',
    scores: {
      'xlaude-mini-k1': 31.2,
      'xlaude-pro-k1': 38.6,
      'xlaude-mini-k2': 36.4,
      'xlaude-pro-k2': 41.2,
    },
  },
  {
    id: 'terminal-21',
    name: 'Terminal-Bench 2.1',
    unit: '%',
    note: 'оценка класса ~31B',
    scores: {
      'xlaude-mini-k1': 52.4,
      'xlaude-pro-k1': 58.8,
      'xlaude-mini-k2': 57.1,
      'xlaude-pro-k2': 61.5,
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
      'xlaude-mini-k1': 58.2,
      'xlaude-pro-k1': 68.4,
      'xlaude-mini-k2': 65.8,
      'xlaude-pro-k2': 72.6,
    },
  },
  {
    id: 'ru-desk',
    name: 'Xelity RU Desk',
    unit: '%',
    note: 'рабочие задачи на русском: письма, ТЗ, отчёты',
    scores: {
      'xlaude-mini-k1': 71.4,
      'xlaude-pro-k1': 78.6,
      'xlaude-mini-k2': 76.9,
      'xlaude-pro-k2': 81.2,
    },
  },
  {
    id: 'code-preview',
    name: 'Xelity Code Preview',
    unit: '%',
    note: 'сборка одностраничного сайта в песочнице чата',
    scores: {
      'xlaude-mini-k1': 48.6,
      'xlaude-pro-k1': 62.4,
      'xlaude-mini-k2': 58.9,
      'xlaude-pro-k2': 67.8,
    },
  },
  {
    id: 'latency',
    name: 'Средняя скорость ответа',
    unit: 'tok/s',
    note: 'типичный чат через API-прокси, без reasoning; TTFT ~1.1–1.3 с',
    scores: {
      'xlaude-mini-k1': 38,
      'xlaude-pro-k1': 35,
      'xlaude-mini-k2': 36,
      'xlaude-pro-k2': 34,
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
  if (unit === 'index' || unit === 'score') return String(value);
  return String(value);
}

/** Краткий канон для system prompt (только при вопросах про бенчмарки) */
export function benchmarksCanonText(): string {
  return [
    `Официальные оценки ${BENCH_META.lab} (${BENCH_META.asOf}). ${BENCH_META.methodology}`,
    'Pro K2 (якорь линейки): AA Intelligence Index v4.1 — 29 (~28/580); Arena AI Text — 1452 Elo; MMLU-Pro 85.2%; MMMLU 88.4%; GPQA Diamond 84.3%; AIME 2026 (без tools) 89.2%; LiveCodeBench v6 80.0%; Codeforces 2150 Elo; τ²-bench avg 76.9% / Retail 86.4%; HLE 19.5% / 26.5% (без tools / с поиском); BigBench Extra Hard 74.4%; MMMU Pro 76.9%; MATH-Vision 85.6%; MedXPertQA Multimodal 61.3%; OmniDocBench 1.5 — 0.131 (меньше лучше); MRCR v2 128K — 66.4%; SWE-Bench Pro ~41.2%; Terminal-Bench 2.1 ~61.5%; скорость ~34–38 tok/s, TTFT ~1.15 с.',
    'Mini/Pro K1–K2 отличаются слабо по знаниям (один класс модели); сильнее — по длине ответа, reasoning и tool-сценариям.',
    'Собственные: Tool Loop Pro K2 72.6%; RU Desk 81.2%; Code Preview 67.8%.',
    'Не раздувай цифры до уровня frontier Ultra/Opus. Не выдумывай другие бенчмарки. Не называй внутренний upstream чужим брендом.',
  ].join('\n');
}
