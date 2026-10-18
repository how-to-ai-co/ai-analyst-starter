import { changeText, formatValue, timeAgo } from "@/lib/format";
import type { KpiView } from "@/lib/types";

export function KpiCard({ k, comparison }: { k: KpiView; comparison: string }) {
  const color = k.good === null ? "text-neutral-500" : k.good ? "text-emerald-700" : "text-red-700";
  const arrow = k.trend === "up" ? "▲" : k.trend === "down" ? "▼" : "•";
  return (
    <article className="card flex flex-col gap-2" aria-label={k.name}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium text-neutral-600">{k.name}</h3>
        {k.sample ? (
          <span className="badge bg-amber-100 text-amber-800">Sample</span>
        ) : k.error ? (
          <span className="badge bg-red-100 text-red-800" title={k.error}>Couldn&rsquo;t refresh</span>
        ) : k.stale ? (
          <span className="badge bg-amber-100 text-amber-800">Needs update</span>
        ) : null}
      </div>
      <p className="text-3xl font-bold tracking-tight">{formatValue(k.value, k.format, k.currency)}</p>
      <p className={`text-sm ${color}`}>{k.trend ? `${arrow} ` : ""}{changeText(k, comparison)}</p>
      <Sparkline points={k.series.map((p) => p.value)} />
      <p className="text-xs text-neutral-500">
        {k.sourceLabel}
        {k.updatedAt && !k.sample ? ` · updated ${timeAgo(k.updatedAt)}` : ""}
      </p>
      {k.error && <p className="text-xs text-red-700">{k.error}</p>}
    </article>
  );
}

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return <div className="h-10" />;
  const w = 220, h = 40;
  const min = Math.min(...points), max = Math.max(...points);
  const span = max - min || 1;
  const d = points.map((v, i) => `${i === 0 ? "M" : "L"}${((i / (points.length - 1)) * w).toFixed(1)},${(h - 4 - ((v - min) / span) * (h - 8)).toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-10 w-full" preserveAspectRatio="none" aria-hidden>
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
