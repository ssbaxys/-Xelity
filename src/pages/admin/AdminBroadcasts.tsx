import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import ChatMarkdown from '../../components/ChatMarkdown';
import { useAuth } from '../../context/AuthContext';
import { uploadBroadcastBanner } from '../../lib/broadcastMedia';
import {
  createBroadcast,
  deleteBroadcast,
  watchBroadcasts,
  type Broadcast,
  type BroadcastKind,
} from '../../lib/rtdb';
import AdminSelect from './AdminSelect';

type WrapKind = 'bold' | 'italic' | 'code' | 'link' | 'h2' | 'ul' | 'quote';

function wrapSelection(
  value: string,
  start: number,
  end: number,
  kind: WrapKind,
): { next: string; selStart: number; selEnd: number } {
  const selected = value.slice(start, end);
  const before = value.slice(0, start);
  const after = value.slice(end);

  const apply = (left: string, right: string, placeholder: string) => {
    const inner = selected || placeholder;
    const next = `${before}${left}${inner}${right}${after}`;
    return {
      next,
      selStart: before.length + left.length,
      selEnd: before.length + left.length + inner.length,
    };
  };

  switch (kind) {
    case 'bold':
      return apply('**', '**', 'жирный');
    case 'italic':
      return apply('*', '*', 'курсив');
    case 'code':
      return apply('`', '`', 'код');
    case 'link':
      return apply('[', '](https://)', selected || 'ссылка');
    case 'h2':
      return apply('\n## ', '\n', selected || 'Заголовок');
    case 'ul':
      return apply('\n- ', '\n', selected || 'пункт');
    case 'quote':
      return apply('\n> ', '\n', selected || 'цитата');
    default:
      return { next: value, selStart: start, selEnd: end };
  }
}

const KIND_OPTIONS: { value: BroadcastKind; label: string }[] = [
  { value: 'news', label: 'Новости' },
  { value: 'update', label: 'Обновление' },
  { value: 'alert', label: 'Важно' },
];

export default function AdminBroadcasts() {
  const { user } = useAuth();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [list, setList] = useState<Broadcast[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [kind, setKind] = useState<BroadcastKind>('news');
  const [eyebrow, setEyebrow] = useState('');
  const [ctaLabel, setCtaLabel] = useState('Понятно');
  const [bannerUrl, setBannerUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');

  useEffect(() => watchBroadcasts(setList), []);

  const applyWrap = (kindWrap: WrapKind) => {
    const el = bodyRef.current;
    if (!el) return;
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const { next, selStart, selEnd } = wrapSelection(body, start, end, kindWrap);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(selStart, selEnd);
    });
  };

  const onBannerFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user) return;
    setUploading(true);
    setError(null);
    try {
      const url = await uploadBroadcastBanner(file, user.uid);
      setBannerUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !title.trim() || !body.trim()) {
      setError('Заполните заголовок и текст.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createBroadcast({
        title,
        body,
        kind,
        eyebrow: eyebrow || undefined,
        ctaLabel: ctaLabel || undefined,
        bannerUrl: bannerUrl || undefined,
        createdBy: user.uid,
        createdByEmail: user.email || undefined,
      });
      setTitle('');
      setBody('');
      setEyebrow('');
      setCtaLabel('Понятно');
      setBannerUrl('');
      setKind('news');
      setTab('edit');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Broadcasts</h2>
        <p className="text-sm text-[var(--a-muted)]">
          Официальные новости в стиле главной. Markdown как в чате, баннер по желанию.
        </p>
      </div>

      <form onSubmit={onSubmit} className="admin-panel space-y-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="block text-xs text-[var(--a-muted)]">
            <span className="mb-1 block">Тип</span>
            <AdminSelect
              value={kind}
              options={KIND_OPTIONS}
              onChange={(v) => setKind(v)}
              className="w-full"
            />
          </div>
          <label className="block text-xs text-[var(--a-muted)]">
            Подпись (eyebrow)
            <input
              value={eyebrow}
              onChange={(e) => setEyebrow(e.target.value)}
              placeholder="Xelity · Новости"
              className="mt-1 w-full rounded-lg border border-[var(--a-border)] bg-[var(--a-input)] px-3 py-2 text-sm outline-none focus:border-[var(--admin-accent)]/50"
            />
          </label>
        </div>

        <label className="block text-xs text-[var(--a-muted)]">
          Заголовок
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[var(--a-border)] bg-[var(--a-input)] px-3 py-2 text-sm font-medium outline-none focus:border-[var(--admin-accent)]/50"
          />
        </label>

        <div>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-[var(--a-muted)]">Текст (Markdown)</span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setTab('edit')}
                className={`rounded-md px-2 py-0.5 text-[11px] ${
                  tab === 'edit'
                    ? 'bg-[var(--admin-accent)] text-white'
                    : 'border border-[var(--a-border)] text-[var(--a-muted)]'
                }`}
              >
                Редактор
              </button>
              <button
                type="button"
                onClick={() => setTab('preview')}
                className={`rounded-md px-2 py-0.5 text-[11px] ${
                  tab === 'preview'
                    ? 'bg-[var(--admin-accent)] text-white'
                    : 'border border-[var(--a-border)] text-[var(--a-muted)]'
                }`}
              >
                Превью
              </button>
            </div>
          </div>

          {tab === 'edit' ? (
            <>
              <div className="mb-1.5 flex flex-wrap gap-1">
                {(
                  [
                    ['bold', 'B'],
                    ['italic', 'I'],
                    ['code', '`'],
                    ['link', '🔗'],
                    ['h2', 'H'],
                    ['ul', '•'],
                    ['quote', '«'],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => applyWrap(k)}
                    className="rounded border border-[var(--a-border)] px-2 py-0.5 text-[12px] font-medium text-[var(--a-strong)] hover:bg-[var(--a-hover)]"
                    title={k}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <textarea
                ref={bodyRef}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={8}
                placeholder={'**Что нового**\n\nКратко о релизе…\n\n- пункт 1\n- пункт 2'}
                className="w-full resize-y rounded-lg border border-[var(--a-border)] bg-[var(--a-input)] px-3 py-2 font-mono text-[13px] leading-relaxed outline-none focus:border-[var(--admin-accent)]/50"
              />
            </>
          ) : (
            <div className="min-h-[12rem] rounded-lg border border-[var(--a-border)] bg-[var(--a-input)] px-3 py-2">
              {body.trim() ? (
                <ChatMarkdown content={body} className="text-[13px]" />
              ) : (
                <p className="text-sm text-[var(--a-faint)]">Пусто — напишите текст</p>
              )}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xs text-[var(--a-muted)]">Баннер (опционально)</p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="rounded-lg border border-[var(--a-border)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--a-hover)] disabled:opacity-40"
            >
              {uploading ? 'Загрузка…' : 'Прикрепить файл'}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void onBannerFile(e)}
            />
            {bannerUrl && (
              <button
                type="button"
                onClick={() => setBannerUrl('')}
                className="text-[11px] text-[var(--a-danger)]"
              >
                Убрать баннер
              </button>
            )}
          </div>
          <input
            value={bannerUrl.startsWith('data:') ? '' : bannerUrl}
            onChange={(e) => setBannerUrl(e.target.value)}
            placeholder="или вставьте https://… URL баннера"
            className="w-full rounded-lg border border-[var(--a-border)] bg-[var(--a-input)] px-3 py-2 text-sm outline-none focus:border-[var(--admin-accent)]/50"
          />
          {bannerUrl.startsWith('data:') && (
            <p className="text-[11px] text-[var(--a-faint)]">Файл прикреплён (локально сжатый)</p>
          )}
          {bannerUrl && (
            <div className="overflow-hidden rounded-lg border border-[var(--a-border)]">
              <img
                src={bannerUrl}
                alt=""
                className="max-h-36 w-full object-cover object-center"
              />
            </div>
          )}
        </div>

        <label className="block text-xs text-[var(--a-muted)]">
          Текст кнопки
          <input
            value={ctaLabel}
            onChange={(e) => setCtaLabel(e.target.value)}
            className="mt-1 w-full max-w-xs rounded-lg border border-[var(--a-border)] bg-[var(--a-input)] px-3 py-2 text-sm outline-none focus:border-[var(--admin-accent)]/50"
          />
        </label>

        {error && <p className="admin-error-inline">{error}</p>}
        <button
          type="submit"
          disabled={busy || uploading}
          className="rounded-lg bg-[var(--admin-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {busy ? 'Отправка…' : 'Опубликовать всем'}
        </button>
      </form>

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-[var(--a-muted)]">
          История ({list.length})
        </h3>
        {list.map((b) => (
          <div
            key={b.id}
            className="admin-panel flex flex-wrap items-start justify-between gap-3 p-4"
          >
            <div className="min-w-0 flex-1 space-y-2">
              {b.bannerUrl && (
                <img
                  src={b.bannerUrl}
                  alt=""
                  className="max-h-28 w-full max-w-md rounded-lg object-cover"
                />
              )}
              <p className="text-[11px] uppercase tracking-wider text-[var(--a-faint)]">
                {(b.eyebrow || b.kind || 'news').toString()}
              </p>
              <p className="font-medium">{b.title}</p>
              <div className="text-sm text-[var(--a-muted)]">
                <ChatMarkdown content={b.body} className="text-[13px]" />
              </div>
              <p className="text-[11px] text-[var(--a-faint)]">
                {new Date(b.createdAt).toLocaleString()}
                {b.createdByEmail ? ` · ${b.createdByEmail}` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void deleteBroadcast(b.id)}
              className="rounded-md border border-[var(--a-border)] px-2.5 py-1 text-[11px] text-[var(--a-danger)] hover:bg-[var(--a-hover)]"
            >
              Удалить
            </button>
          </div>
        ))}
        {!list.length && (
          <p className="text-sm text-[var(--a-faint)]">Пока нет объявлений</p>
        )}
      </div>
    </div>
  );
}
