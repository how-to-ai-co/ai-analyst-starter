import type { Format, KpiView } from "./types";

export function formatValue(v: number | null, format: Format, currency = "USD"): string {
  if (v === null || v === undefined) return "No data";
  if (format === "percent") return `${trim(v)}%`;
  if (format === "currency") {
    try {
      return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: Math.abs(v) < 100 ? 2 : 0 }).format(v);
    } catch {
      return `${currency} ${Math.round(v).toLocaleString("en-US")}`;
    }
  }
  return Number.isInteger(v) ? v.toLocaleString("en-US") : trim(v);
}

const trim = (v: number) => (Math.round(v * 10) / 10).toLocaleString("en-US");

export function comparisonLabel(c: string): string {
  return { yesterday: "vs yesterday", last_week: "vs last week", last_month: "vs last month", target: "vs target" }[c] ?? "";
}

/** "up 8% vs last week", "down 3 vs last week", "flat". */
export function changeText(k: KpiView, comparison: string): string {
  if (k.change === null || k.previous === null) return "no comparison yet";
  if (Math.abs(k.change) < 1e-9) return "flat";
  const dir = k.change > 0 ? "up" : "down";
  const amount =
    k.format === "percent"
      ? `${trim(Math.abs(k.change))} pts`
      : k.changePct !== null && Math.abs(k.previous) >= 10
        ? `${Math.round(Math.abs(k.changePct))}%`
        : formatValue(Math.abs(k.change), k.format, k.currency);
  return `${dir} ${amount} ${comparisonLabel(comparison)}`;
}

export function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 36) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}

/** "On pace: $41,200 of $50,000 this month, heading for $54,100." */
export function paceText(k: KpiView): string | null {
  const p = k.pace;
  if (!p) return null;
  const f = (v: number) => formatValue(round(v, k.format), k.format, k.currency);
  const label = p.status === "ahead" ? "Ahead" : p.status === "on_pace" ? "On pace" : "Behind";
  const when = { week: "this week", month: "this month", quarter: "this quarter", year: "this year" }[p.period];
  if (p.aggregate === "latest") return `${label}: ${f(p.actual)} against a target of ${f(p.target)}`;
  return `${label}: ${f(p.actual)} of ${f(p.target)} ${when}${p.projected !== null ? `, heading for ${f(p.projected)}` : ""}`;
}

const round = (v: number, format: string) => (format === "percent" ? Math.round(v * 10) / 10 : Math.round(v));
