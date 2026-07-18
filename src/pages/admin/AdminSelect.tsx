import { useEffect, useId, useRef, useState } from 'react';
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

export default function AdminSelect<T extends string>({
  value,
  options,
  onChange,
  disabled,
  className = '',
  placeholder = 'Выбрать',
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selected = options.find((o) => o.value === value);

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
    const onScroll = () => setOpen(false);
    window.addEventListener('pointerdown', onPointer);
    window.addEventListener('keydown', onKey);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  const toggle = () => {
    if (disabled) return;
    if (open) {
      setOpen(false);
      return;
    }
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) return;
    const width = Math.max(rect.width, 168);
    let left = rect.left;
    if (left + width > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - width - 8);
    }
    setPos({
      top: rect.bottom + 6,
      left,
      width,
    });
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
        className={`inline-flex min-w-[7.5rem] items-center justify-between gap-2 rounded-xl border border-[#2a1c1c] bg-[#0d0a0a]/95 px-2.5 py-1.5 text-left text-xs text-[#f3ecec] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition hover:border-[#3a2424] hover:shadow-[0_0_0_3px_rgba(198,40,40,0.08)] disabled:opacity-40 ${
          open ? 'border-[#c62828]/50 shadow-[0_0_0_3px_rgba(198,40,40,0.12)]' : ''
        } ${className}`}
      >
        <span className="min-w-0 truncate">{selected?.label ?? placeholder}</span>
        <IconChevronDown
          className={`h-3 w-3 shrink-0 text-[#6e5555] transition duration-300 ${
            open ? 'rotate-180 text-[#ff8a80]' : ''
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
            className="admin-select-menu fixed z-[200] max-h-56 overflow-y-auto rounded-xl py-1.5"
            style={{ top: pos.top, left: pos.left, width: pos.width }}
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
                    active ? 'bg-[#c62828]/12 text-white' : 'text-[#c5b0b0]'
                  }`}
                >
                  <span className="mt-0.5 flex h-3 w-3 shrink-0 items-center justify-center text-[#c62828]">
                    {active ? <IconCheck className="h-3 w-3" /> : null}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-medium text-[#f3ecec]">{opt.label}</span>
                    {opt.hint && (
                      <span className="mt-0.5 block text-[10px] text-[#6e5555]">{opt.hint}</span>
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
