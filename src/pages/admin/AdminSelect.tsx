import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { IconCheck, IconChevronDown } from '../../components/icons';

export type AdminSelectOption<T extends string> = {
  value: T;
  label: string;
  hint?: string;
};

type Props<T extends string> = {
  value: T;
  options: AdminSelectOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
};

type MenuPos = { top: number; left: number; width: number; place: 'below' | 'above' };

function copyShellVars(from: Element | null): CSSProperties {
  if (!from || !(from instanceof HTMLElement)) return {};
  const cs = getComputedStyle(from);
  const keys = [
    '--admin-accent',
    '--admin-accent-soft',
    '--a-text',
    '--a-muted',
    '--a-faint',
    '--a-border',
    '--a-border-strong',
    '--a-menu',
    '--a-accent-fg',
    '--a-hover',
  ] as const;
  const style: Record<string, string> = {};
  for (const k of keys) {
    const v = cs.getPropertyValue(k).trim();
    if (v) style[k] = v;
  }
  return style as CSSProperties;
}

export default function AdminSelect<T extends string>({
  value,
  options,
  onChange,
  disabled,
  className = '',
  placeholder = 'Выбрать',
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<MenuPos | null>(null);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selected = options.find((o) => o.value === value);

  const placeMenu = () => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.min(Math.max(rect.width, 168), window.innerWidth - 16);
    let left = rect.left;
    if (left + width > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - width - 8);
    }
    if (left < 8) left = 8;

    const menuH = menuRef.current?.offsetHeight || 224;
    const spaceBelow = window.innerHeight - rect.bottom - 10;
    const spaceAbove = rect.top - 10;
    const place: 'below' | 'above' =
      spaceBelow < menuH && spaceAbove > spaceBelow ? 'above' : 'below';

    setPos({
      top: place === 'below' ? rect.bottom + 6 : Math.max(8, rect.top - menuH - 6),
      left,
      width,
      place,
    });
    setMenuStyle(copyShellVars(btnRef.current?.closest('.admin-shell') ?? null));
  };

  useLayoutEffect(() => {
    if (!open) return;
    placeMenu();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    // только скролл окна — не закрывать при скролле списка тикетов
    const onWinScroll = () => setOpen(false);
    const onResize = () => placeMenu();
    window.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onWinScroll);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onWinScroll);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  const toggle = () => {
    if (disabled) return;
    if (open) {
      setOpen(false);
      return;
    }
    placeMenu();
    setOpen(true);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={toggle}
        className={`admin-select-trigger ${open ? 'is-open' : ''} ${className}`}
      >
        <span className="min-w-0 truncate">{selected?.label ?? placeholder}</span>
        <IconChevronDown
          className={`h-3 w-3 shrink-0 text-[var(--a-faint)] transition duration-300 ${
            open ? 'rotate-180 text-[var(--a-accent-fg)]' : ''
          }`}
        />
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            id={listId}
            role="listbox"
            className="admin-select-menu fixed z-[300] max-h-56 overflow-y-auto rounded-xl py-1.5"
            style={{
              top: pos.top,
              left: pos.left,
              width: pos.width,
              transformOrigin: pos.place === 'above' ? 'bottom center' : 'top center',
              ...menuStyle,
            }}
          >
            {options.map((opt) => {
              const active = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={`admin-select-option flex w-full items-start gap-2 px-3 py-2 text-left text-xs ${
                    active ? 'is-active' : ''
                  }`}
                >
                  <span className="mt-0.5 flex h-3 w-3 shrink-0 items-center justify-center text-[var(--admin-accent)]">
                    {active ? <IconCheck className="h-3 w-3" /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium text-[var(--a-text)]">{opt.label}</span>
                    {opt.hint && (
                      <span className="mt-0.5 block text-[10px] text-[var(--a-faint)]">{opt.hint}</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
