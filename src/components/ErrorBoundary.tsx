import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  fallbackTitle?: string;
};

type State = { error: Error | null };

/** Ловит падения React-дерева, чтобы сайт не становился белым экраном */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Xelity ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-[var(--c-bg,#0d0a0a)] px-6 text-center text-[var(--c-text,#f3ecec)]">
        <p className="text-[15px] font-semibold">
          {this.props.fallbackTitle || 'Что-то пошло не так'}
        </p>
        <p className="max-w-sm text-[13px] text-[var(--c-muted,#9a8585)]">
          Страница временно недоступна. Попробуйте обновить — данные чатов сохранены локально.
        </p>
        <button
          type="button"
          className="rounded-lg bg-[#c62828] px-4 py-2 text-[13px] font-medium text-white"
          onClick={() => {
            this.setState({ error: null });
            window.location.reload();
          }}
        >
          Обновить
        </button>
      </div>
    );
  }
}
