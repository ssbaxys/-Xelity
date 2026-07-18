import type { ReactNode } from 'react';
import { IconCheck, IconChevronDown } from './icons';

type CheckboxProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
};

export function CustomCheckbox({ checked, onChange, label }: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition hover:bg-white/[0.03]"
    >
      <span
        className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border transition ${
          checked ? 'border-[#c62828] bg-[#c62828] text-white' : 'border-[#333] bg-transparent'
        }`}
      >
        {checked && <IconCheck className="h-2.5 w-2.5" />}
      </span>
      <span className="text-[12px] text-[#a1a1a1]">{label}</span>
    </button>
  );
}

type SliderProps = {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
};

export function CustomSlider({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  format = (v) => String(v),
}: SliderProps) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className="space-y-2 px-2 py-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] text-[#a1a1a1]">{label}</span>
        <span className="text-[11px] tabular-nums text-[#888]">{format(value)}</span>
      </div>
      <div className="relative h-4">
        <div className="absolute top-1/2 h-[3px] w-full -translate-y-1/2 rounded-full bg-[#222]" />
        <div
          className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full bg-[#c62828]"
          style={{ width: `${pct}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="chat-range absolute inset-0 w-full cursor-pointer appearance-none bg-transparent"
          aria-label={label}
        />
      </div>
    </div>
  );
}

type ExpandableProps = {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
};

export function ExpandableList({ title, open, onToggle, children }: ExpandableProps) {
  return (
    <div className="overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left transition hover:bg-white/[0.03]"
      >
        <span className="text-[12px] text-[#a1a1a1]">{title}</span>
        <IconChevronDown
          className={`h-3 w-3 text-[#666] transition ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && <div className="pb-1">{children}</div>}
    </div>
  );
}
