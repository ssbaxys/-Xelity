type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
};

/** Кастомный анимированный чекбокс для админки */
export default function AdminCheckbox({
  checked,
  onChange,
  label,
  disabled,
  className = '',
}: Props) {
  return (
    <label className={`admin-check ${disabled ? 'pointer-events-none opacity-40' : ''} ${className}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="admin-check-box" aria-hidden />
      <span>{label}</span>
    </label>
  );
}
