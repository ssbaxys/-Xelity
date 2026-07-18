function BarChart({
  data,
  color = '#c62828',
}: {
  data: { label: string; value: number }[];
  color?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const barMaxPx = 112;

  return (
    <div className="flex h-44 items-end gap-1.5 pt-1">
      {data.map((d, i) => {
        const h = Math.max(d.value > 0 ? 6 : 2, Math.round((d.value / max) * barMaxPx));
        return (
          <div key={d.label} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1">
            <span className="text-[10px] tabular-nums text-[#9a8585] transition-opacity duration-300">
              {d.value}
            </span>
            <div
              className="admin-bar w-full max-w-[28px]"
              style={{
                height: `${h}px`,
                minHeight: `${h}px`,
                background: color.startsWith('#')
                  ? undefined
                  : color,
                animationDelay: `${i * 40}ms`,
              }}
              title={`${d.label}: ${d.value}`}
            />
            <span className="w-full truncate text-center text-[9px] text-[#6e5555]">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: string | number; hint?: string }) {
  return (
    <div className="admin-stat">
      <p className="text-[11px] uppercase tracking-wider text-[#6e5555]">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-[11px] text-[#9a8585]">{hint}</p>}
    </div>
  );
}

export { BarChart };
