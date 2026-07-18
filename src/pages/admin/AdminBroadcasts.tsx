import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  createBroadcast,
  deleteBroadcast,
  watchBroadcasts,
  type Broadcast,
} from '../../lib/rtdb';

export default function AdminBroadcasts() {
  const { user } = useAuth();
  const [list, setList] = useState<Broadcast[]>([]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => watchBroadcasts(setList), []);

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
        createdBy: user.uid,
        createdByEmail: user.email || undefined,
      });
      setTitle('');
      setBody('');
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
        <p className="text-sm text-[#9a8585]">
          Объявления показываются в чате, пока пользователь не нажмёт «Понятно»
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="admin-panel space-y-3 p-4"
      >
        <label className="block text-xs text-[#9a8585]">
          Заголовок
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-lg border border-[#2a1c1c] bg-[#0d0a0a] px-3 py-2 text-sm outline-none focus:border-[#c62828]/50"
          />
        </label>
        <label className="block text-xs text-[#9a8585]">
          Текст
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            className="mt-1 w-full resize-y rounded-lg border border-[#2a1c1c] bg-[#0d0a0a] px-3 py-2 text-sm outline-none focus:border-[#c62828]/50"
          />
        </label>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-[#c62828] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          Отправить всем
        </button>
      </form>

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-[#9a8585]">История ({list.length})</h3>
        {list.map((b) => (
          <div
            key={b.id}
            className="admin-panel flex flex-wrap items-start justify-between gap-3 p-4"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium">{b.title}</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-[#9a8585]">{b.body}</p>
              <p className="mt-2 text-[11px] text-[#6e5555]">
                {new Date(b.createdAt).toLocaleString()}
                {b.createdByEmail ? ` · ${b.createdByEmail}` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void deleteBroadcast(b.id)}
              className="rounded-md border border-[#2a1c1c] px-2.5 py-1 text-[11px] text-[#e57373] hover:bg-white/5"
            >
              Удалить
            </button>
          </div>
        ))}
        {!list.length && (
          <p className="text-sm text-[#6e5555]">Пока нет объявлений</p>
        )}
      </div>
    </div>
  );
}
