/** 22 уникальных механики троллинга для режима бога */

export type GodPrankId =
  | 'visual_lag'
  | 'scroll_stutter'
  | 'fsb_listen'
  | 'fbi_listen'
  | 'fake_typing'
  | 'invert_colors'
  | 'blur_messages'
  | 'mirror_ui'
  | 'tiny_text'
  | 'giant_text'
  | 'fake_offline'
  | 'credit_panic'
  | 'cursor_chaos'
  | 'emoji_rain'
  | 'input_delay'
  | 'mirror_compose'
  | 'fake_review'
  | 'matrix_veil'
  | 'confetti_burst'
  | 'whisper_mode'
  | 'nuke_countdown'
  | 'double_vision';

export type GodPrankDef = {
  id: GodPrankId;
  label: string;
  hint: string;
};

export const GOD_PRANKS: GodPrankDef[] = [
  { id: 'visual_lag', label: 'Визуальные лаги', hint: 'Интерфейс подтормаживает и дёргается' },
  { id: 'scroll_stutter', label: 'Дёрганый скролл', hint: 'Лента периодически прыгает' },
  { id: 'fsb_listen', label: 'Оперативник ФСБ', hint: 'Баннер: ваш чат прослушивают' },
  { id: 'fbi_listen', label: 'Оперативник ФБР', hint: 'Баннер: мониторинг спецслужбы' },
  { id: 'fake_typing', label: 'Вечное «печатает…»', hint: 'Индикатор набора без ответа' },
  { id: 'invert_colors', label: 'Негатив', hint: 'Инвертированные цвета чата' },
  { id: 'blur_messages', label: 'Размытые ответы', hint: 'Текст ассистента под блюром' },
  { id: 'mirror_ui', label: 'Зеркало', hint: 'Весь чат отражён по горизонтали' },
  { id: 'tiny_text', label: 'Мелкий шрифт', hint: 'Почти нечитаемый текст' },
  { id: 'giant_text', label: 'Гигантский шрифт', hint: 'Огромные буквы в ленте' },
  { id: 'fake_offline', label: 'Нет сети', hint: 'Фейковая плашка «офлайн»' },
  { id: 'credit_panic', label: 'Паника кредитов', hint: 'Всплывашка про исчезающие кредиты' },
  { id: 'cursor_chaos', label: 'Курсор-хаос', hint: 'Курсор прыгает и оставляет след' },
  { id: 'emoji_rain', label: 'Дождь эмодзи', hint: 'Падающие смайлы поверх чата' },
  { id: 'input_delay', label: 'Задержка ввода', hint: 'Клавиши доходят с лагом' },
  { id: 'mirror_compose', label: 'Зеркальный ввод', hint: 'Поле ввода пишет задом наперёд' },
  { id: 'fake_review', label: 'Проверка аккаунта', hint: 'Предупреждение модерации' },
  { id: 'matrix_veil', label: 'Матрица', hint: 'Зелёный цифровой дождь' },
  { id: 'confetti_burst', label: 'Конфетти', hint: 'Случайные вспышки конфетти' },
  { id: 'whisper_mode', label: 'Шёпот', hint: 'Сообщения почти прозрачные' },
  { id: 'nuke_countdown', label: 'Таймер удаления', hint: 'Фейковый обратный отсчёт чата' },
  { id: 'double_vision', label: 'Двоение', hint: 'Призрачная копия ленты' },
];

export function isGodPrankId(v: unknown): v is GodPrankId {
  return typeof v === 'string' && GOD_PRANKS.some((p) => p.id === v);
}

/**
 * Firebase RTDB превращает массивы в объекты `{0: id, 1: id}` —
 * принимаем и массив, и map, и `{id: true}`.
 */
export function normalizePrankIds(raw: unknown): GodPrankId[] {
  const out: GodPrankId[] = [];
  const push = (x: unknown) => {
    if (isGodPrankId(x) && !out.includes(x)) out.push(x);
  };

  if (Array.isArray(raw)) {
    for (const x of raw) push(x);
  } else if (raw && typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    const keys = Object.keys(o);
    const asFlagMap = keys.length > 0 && keys.every((k) => isGodPrankId(k));
    if (asFlagMap) {
      for (const k of keys) {
        if (o[k] === true || o[k] === 1 || o[k] === '1') push(k);
      }
    } else {
      for (const k of keys.sort((a, b) => Number(a) - Number(b) || a.localeCompare(b))) {
        push(o[k]);
      }
    }
  }

  return out.slice(0, 22);
}

/** Пишем map id→true — Firebase не ломает структуру как массивы */
export function pranksToFirebase(
  pranks: GodPrankId[],
): Record<string, true> | null {
  const ids = normalizePrankIds(pranks);
  if (!ids.length) return null;
  const out: Record<string, true> = {};
  for (const id of ids) out[id] = true;
  return out;
}
