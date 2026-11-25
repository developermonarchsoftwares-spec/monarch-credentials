// Dependency-free SVG bar chart. One series, one colour; values are labelled so nothing relies on colour alone.
export const BarChart = ({ data, label, height = 180 }: { data: { label: string; value: number }[]; label: string; height?: number }) => {
  const max = Math.max(1, ...data.map((d) => d.value));
  const w = 100 / data.length;
  const total = data.reduce((a, d) => a + d.value, 0);
  return (
    <figure>
      <svg viewBox={`0 0 100 ${height / 4}`} className="w-full" style={{ height }} role="img" aria-label={`${label}. Total ${total}.`} preserveAspectRatio="none">
        {[0.25, 0.5, 0.75, 1].map((g) => <line key={g} x1="0" x2="100" y1={(height / 4) * (1 - g) * 0.82 + 4} y2={(height / 4) * (1 - g) * 0.82 + 4} stroke="#e5e5e5" strokeWidth="0.25" vectorEffect="non-scaling-stroke" />)}
        {data.map((d, i) => {
          const h = (d.value / max) * (height / 4) * 0.82;
          return <rect key={d.label} x={i * w + w * 0.2} width={w * 0.6} y={(height / 4) * 0.82 + 4 - h} height={Math.max(h, d.value ? 0.6 : 0)} fill="#171717" rx="0.4"><title>{`${d.label}: ${d.value}`}</title></rect>;
        })}
      </svg>
      <div className="mt-1 flex" aria-hidden>
        {data.map((d) => <div key={d.label} className="flex-1 text-center"><div className="tabular text-xs font-semibold text-navy">{d.value}</div><div className="text-[11px] text-muted">{d.label}</div></div>)}
      </div>
    </figure>
  );
};
