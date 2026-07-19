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

export function normalizePrankIds(raw: unknown): GodPrankId[] {
  if (!Array.isArray(raw)) return [];
  const out: GodPrankId[] = [];
  for (const x of raw) {
    if (isGodPrankId(x) && !out.includes(x)) out.push(x);
  }
  return out.slice(0, 22);
}
