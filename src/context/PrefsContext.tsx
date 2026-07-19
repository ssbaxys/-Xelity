import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export type AppLanguage = 'ru' | 'en';
export type AppTheme = 'dark' | 'light';
export type UiScale = 'sm' | 'md' | 'lg';

type Prefs = {
  language: AppLanguage;
  theme: AppTheme;
  uiScale: UiScale;
  /** Показывать технические детали ошибок в чате */
  debug: boolean;
};

type PrefsContextValue = Prefs & {
  setLanguage: (language: AppLanguage) => void;
  setTheme: (theme: AppTheme) => void;
  setUiScale: (uiScale: UiScale) => void;
  setDebug: (debug: boolean) => void;
  t: (key: string) => string;
};

const STORAGE_KEY = 'xelity-prefs-v1';

const DEFAULTS: Prefs = {
  language: 'ru',
  theme: 'dark',
  uiScale: 'md',
  debug: false,
};

const DICT: Record<AppLanguage, Record<string, string>> = {
  ru: {
    'nav.chat': 'Чат',
    'nav.pricing': 'Тарифы',
    'nav.product': 'Продукт',
    'nav.model': 'Модель',
    'nav.company': 'Компания',
    'nav.safety': 'Безопасность',
    'nav.login': 'Войти',
    'nav.register': 'Регистрация',
    'nav.logout': 'Выйти',
    'nav.theme.toDark': 'Тёмная тема',
    'nav.theme.toLight': 'Светлая тема',
    'chat.new': 'Новый чат',
    'chat.search': 'Поиск',
    'chat.sort': 'Сортировка',
    'chat.sort.updated': 'По дате',
    'chat.sort.alpha': 'По алфавиту',
    'chat.account': 'Аккаунт',
    'chat.settings': 'Настройки',
    'chat.language': 'Язык',
    'chat.theme': 'Тема',
    'chat.theme.dark': 'Тёмная',
    'chat.theme.light': 'Светлая',
    'chat.scale': 'Размер',
    'chat.scale.sm': 'S',
    'chat.scale.md': 'M',
    'chat.scale.lg': 'L',
    'chat.debug': 'Отладка',
    'chat.debug.hint': 'Показывать детали ошибок сервера',
    'chat.debug.details': 'Подробности',
    'chat.login': 'Войти',
    'chat.login.hint': 'Email или Google',
    'chat.logout': 'Выйти',
    'chat.empty': 'Начните диалог',
    'chat.empty.hint': 'Создайте чат слева или нажмите кнопку ниже',
    'chat.empty.list': 'Чатов пока нет',
    'chat.empty.list.hint': 'Создайте новый — кнопка выше',
    'chat.create': 'Создать чат',
    'chat.first': 'Напишите первое сообщение',
    'chat.message': 'Сообщение',
    'chat.clear': 'Очистить',
    'chat.home': 'Главная',
    'chat.guest': 'Гость',
    'chat.notfound': 'Ничего не найдено',
  },
  en: {
    'nav.chat': 'Chat',
    'nav.pricing': 'Pricing',
    'nav.product': 'Product',
    'nav.model': 'Model',
    'nav.company': 'Company',
    'nav.safety': 'Safety',
    'nav.login': 'Log in',
    'nav.register': 'Sign up',
    'nav.logout': 'Log out',
    'nav.theme.toDark': 'Dark theme',
    'nav.theme.toLight': 'Light theme',
    'chat.new': 'New chat',
    'chat.search': 'Search',
    'chat.sort': 'Sort',
    'chat.sort.updated': 'By date',
    'chat.sort.alpha': 'A–Z',
    'chat.account': 'Account',
    'chat.settings': 'Settings',
    'chat.language': 'Language',
    'chat.theme': 'Theme',
    'chat.theme.dark': 'Dark',
    'chat.theme.light': 'Light',
    'chat.scale': 'Size',
    'chat.scale.sm': 'S',
    'chat.scale.md': 'M',
    'chat.scale.lg': 'L',
    'chat.debug': 'Debug',
    'chat.debug.hint': 'Show server error details',
    'chat.debug.details': 'Details',
    'chat.login': 'Log in',
    'chat.login.hint': 'Email or Google',
    'chat.logout': 'Log out',
    'chat.empty': 'Start a conversation',
    'chat.empty.hint': 'Create a chat on the left or tap the button below',
    'chat.empty.list': 'No chats yet',
    'chat.empty.list.hint': 'Create a new one with the button above',
    'chat.create': 'Create chat',
    'chat.first': 'Write your first message',
    'chat.message': 'Message',
    'chat.clear': 'Clear',
    'chat.home': 'Home',
    'chat.guest': 'Guest',
    'chat.notfound': 'Nothing found',
  },
};

const PrefsContext = createContext<PrefsContextValue | null>(null);

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Prefs>;
    return {
      language: parsed.language === 'en' ? 'en' : 'ru',
      theme: parsed.theme === 'light' ? 'light' : 'dark',
      uiScale: parsed.uiScale === 'sm' || parsed.uiScale === 'lg' ? parsed.uiScale : 'md',
      debug: Boolean(parsed.debug),
    };
  } catch {
    return DEFAULTS;
  }
}

function applyPrefs(prefs: Prefs) {
  const root = document.documentElement;
  root.dataset.theme = prefs.theme;
  root.dataset.uiScale = prefs.uiScale;
  root.lang = prefs.language;
  root.style.colorScheme = prefs.theme;
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(() => loadPrefs());

  useEffect(() => {
    applyPrefs(prefs);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  }, [prefs]);

  const setLanguage = useCallback((language: AppLanguage) => {
    setPrefs((p) => ({ ...p, language }));
  }, []);

  const setTheme = useCallback((theme: AppTheme) => {
    setPrefs((p) => ({ ...p, theme }));
  }, []);

  const setUiScale = useCallback((uiScale: UiScale) => {
    setPrefs((p) => ({ ...p, uiScale }));
  }, []);

  const setDebug = useCallback((debug: boolean) => {
    setPrefs((p) => ({ ...p, debug }));
  }, []);

  const t = useCallback(
    (key: string) => DICT[prefs.language][key] ?? DICT.ru[key] ?? key,
    [prefs.language],
  );

  const value = useMemo(
    () => ({ ...prefs, setLanguage, setTheme, setUiScale, setDebug, t }),
    [prefs, setLanguage, setTheme, setUiScale, setDebug, t],
  );

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs() {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error('usePrefs must be used within PrefsProvider');
  return ctx;
}
