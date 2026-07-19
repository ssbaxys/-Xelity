import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import { MODELS, type UiModelId } from '../../lib/models';
import {
  saveModelSystemPrompt,
  watchModelPrompts,
  type ModelSystemPrompt,
} from '../../lib/rtdb';
import AdminSelect from './AdminSelect';

export default function AdminModelPrompts() {
  const { user } = useAuth();
  const [map, setMap] = useState<Record<string, ModelSystemPrompt>>({});
  const [modelId, setModelId] = useState<UiModelId>(MODELS[0].id);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  useEffect(() => watchModelPrompts(setMap), []);

  useEffect(() => {
    setText(map[modelId]?.text ?? '');
    setOk(null);
    setError(null);
  }, [modelId, map]);

  const selected = useMemo(() => MODELS.find((m) => m.id === modelId), [modelId]);
  const meta = map[modelId];

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    setError(null);
    setOk(null);
    try {
      await saveModelSystemPrompt({
        modelId,
        text,
        updatedBy: user.uid,
        updatedByEmail: user.email || undefined,
      });
      setOk('Сохранено. Промпт применится ко всем новым ответам этой модели.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Промпты моделей</h2>
        <p className="text-sm text-[var(--a-muted)]">
          Системный промпт администратора для модели. Имеет высший приоритет над стилем и общими
          правилами продукта (кроме безопасности и идентичности Xlaude). Применяется во всех чатах
          этой модели.
        </p>
      </div>

      <form onSubmit={onSubmit} className="admin-panel space-y-4 p-4">
        <label className="block text-xs text-[var(--a-muted)]">
          Модель
          <div className="mt-1">
            <AdminSelect
              value={modelId}
              onChange={(v) => setModelId(v as UiModelId)}
              options={MODELS.map((m) => ({
                value: m.id,
                label: `${m.name} (${m.generation})`,
              }))}
            />
          </div>
        </label>

        {selected && (
          <p className="text-[11px] text-[var(--a-faint)]">
            {selected.desc} · id <span className="text-[var(--a-muted)]">{selected.id}</span>
          </p>
        )}

        <label className="block text-xs text-[var(--a-muted)]">
          Системный промпт модели
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 8000))}
            rows={12}
            placeholder="Например: всегда отвечай структурировано, используй таблицы для сравнений…"
            className="mt-1 w-full resize-y rounded-lg border border-[var(--a-border)] bg-[var(--a-input)] px-3 py-2 font-mono text-sm outline-none focus:border-[var(--admin-accent)]/50"
          />
          <span className="mt-1 block text-[10px] text-[var(--a-faint)]">
            {text.length}/8000 · пустое поле = без доп. промпта
          </span>
        </label>

        {meta?.updatedAt ? (
          <p className="text-[11px] text-[var(--a-faint)]">
            Обновлено {new Date(meta.updatedAt).toLocaleString()}
            {meta.updatedByEmail ? ` · ${meta.updatedByEmail}` : ''}
          </p>
        ) : (
          <p className="text-[11px] text-[var(--a-faint)]">Для этой модели доп. промпт ещё не задан</p>
        )}

        {error && <p className="admin-error-inline">{error}</p>}
        {ok && <p className="text-xs text-emerald-400/90">{ok}</p>}

        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-[var(--admin-accent)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {busy ? 'Сохранение…' : 'Сохранить'}
        </button>
      </form>
    </div>
  );
}
