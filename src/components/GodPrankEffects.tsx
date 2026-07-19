import { useEffect, useMemo, useState } from 'react';
import type { GodPrankId } from '../lib/godPranks';

type Props = {
  pranks: GodPrankId[];
  /** для зеркала композера — текущий draft наружу не меняем, только показ */
  composeValue?: string;
};

/** Визуальные/механические эффекты троллинга поверх чата пользователя */
export default function GodPrankEffects({ pranks }: Props) {
  const set = useMemo(() => new Set(pranks), [pranks]);
  const [nukeLeft, setNukeLeft] = useState(59);
  const [creditFlash, setCreditFlash] = useState(false);
  const [confetti, setConfetti] = useState<{ id: number; left: number }[]>([]);
  const [emojis, setEmojis] = useState<{ id: number; left: number; char: string }[]>([]);

  useEffect(() => {
    if (!set.has('nuke_countdown')) return;
    setNukeLeft(59);
    const t = window.setInterval(() => {
      setNukeLeft((n) => (n <= 0 ? 59 : n - 1));
    }, 1000);
    return () => window.clearInterval(t);
  }, [set]);

  useEffect(() => {
    if (!set.has('credit_panic')) return;
    const show = () => {
      setCreditFlash(true);
      window.setTimeout(() => setCreditFlash(false), 2800);
    };
    show();
    const t = window.setInterval(show, 14000);
    return () => window.clearInterval(t);
  }, [set]);

  useEffect(() => {
    if (!set.has('confetti_burst')) return;
    const t = window.setInterval(() => {
      const batch = Array.from({ length: 12 }, (_, i) => ({
        id: Date.now() + i,
        left: Math.random() * 100,
      }));
      setConfetti(batch);
      window.setTimeout(() => setConfetti([]), 1600);
    }, 8000);
    return () => window.clearInterval(t);
  }, [set]);

  useEffect(() => {
    if (!set.has('emoji_rain')) return;
    const chars = ['👀', '🕵️', '📡', '🐸', '💀', '🤡', '📎'];
    const t = window.setInterval(() => {
      setEmojis((prev) =>
        [
          ...prev.slice(-18),
          {
            id: Date.now(),
            left: Math.random() * 96,
            char: chars[Math.floor(Math.random() * chars.length)]!,
          },
        ],
      );
    }, 420);
    return () => window.clearInterval(t);
  }, [set]);

  useEffect(() => {
    if (!set.has('cursor_chaos')) return;
    const onMove = (e: MouseEvent) => {
      if (Math.random() > 0.08) return;
      const el = document.createElement('div');
      el.className = 'god-prank-cursor-dot';
      el.style.left = `${e.clientX}px`;
      el.style.top = `${e.clientY}px`;
      document.body.appendChild(el);
      window.setTimeout(() => el.remove(), 700);
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [set]);

  if (!pranks.length) return null;

  return (
    <div className="god-prank-layer pointer-events-none" aria-hidden>
      {set.has('fsb_listen') && (
        <div className="god-prank-banner god-prank-banner--fsb">
          Оперативник ФСБ прослушивает этот чат
        </div>
      )}
      {set.has('fbi_listen') && (
        <div className="god-prank-banner god-prank-banner--fbi">
          Оперативник ФБР ведёт мониторинг переписки
        </div>
      )}
      {set.has('fake_offline') && (
        <div className="god-prank-banner god-prank-banner--offline">
          Нет соединения с сервером · повтор через несколько секунд…
        </div>
      )}
      {set.has('fake_review') && (
        <div className="god-prank-banner god-prank-banner--review">
          Аккаунт на проверке. Командование рассчитывает на ваше спокойствие.
        </div>
      )}
      {set.has('fake_typing') && (
        <div className="god-prank-typing">Собеседник печатает…</div>
      )}
      {set.has('nuke_countdown') && (
        <div className="god-prank-nuke">
          Чат будет удалён через {nukeLeft}с
        </div>
      )}
      {creditFlash && set.has('credit_panic') && (
        <div className="god-prank-toast">Кредиты стремительно заканчиваются!</div>
      )}
      {set.has('matrix_veil') && <div className="god-prank-matrix" />}
      {set.has('double_vision') && <div className="god-prank-double" />}
      {confetti.map((c) => (
        <span
          key={c.id}
          className="god-prank-confetti"
          style={{ left: `${c.left}%` }}
        />
      ))}
      {emojis.map((e) => (
        <span
          key={e.id}
          className="god-prank-emoji"
          style={{ left: `${e.left}%` }}
        >
          {e.char}
        </span>
      ))}
    </div>
  );
}

export function godPrankClassNames(pranks: GodPrankId[]): string {
  const classes: string[] = [];
  for (const id of pranks) {
    classes.push(`god-prank--${id}`);
  }
  return classes.join(' ');
}
