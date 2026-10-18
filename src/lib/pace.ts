import type { Kpi, Pace, Point } from "./types";

/** Is this KPI on pace for its target? Dates are compared as YYYY-MM-DD in the member's time zone. */
export function computePace(kpi: Kpi, series: Point[], today: string): Pace | undefined {
  if (typeof kpi.target !== "number" || kpi.target === 0 || !kpi.targetPeriod) return undefined;
  const period = kpi.targetPeriod;
  const aggregate = kpi.aggregate ?? "sum";
  const { start, days } = periodBounds(period, today);
  const goodUp = (kpi.goodWhen ?? "up") === "up";

  if (aggregate === "latest") {
    const actual = series[series.length - 1]?.value;
    if (actual === undefined) return undefined;
    const ratio = goodUp ? actual / kpi.target : kpi.target / Math.max(actual, 1e-9);
    return { target: kpi.target, period, aggregate, actual, expected: null, projected: null, status: statusFor(ratio), pct: (actual / kpi.target) * 100 };
  }

  const actual = series.filter((p) => p.date >= start && p.date <= today).reduce((a, p) => a + p.value, 0);
  const elapsed = Math.min(days, daysBetween(start, today) + 1);
  const fraction = elapsed / days;
  const expected = kpi.target * fraction;
  const projected = fraction > 0 ? actual / fraction : null;
  const ratio = goodUp ? actual / Math.max(expected, 1e-9) : expected / Math.max(actual, 1e-9);
  return { target: kpi.target, period, aggregate, actual, expected, projected, status: statusFor(ratio), pct: (actual / kpi.target) * 100 };
}

const statusFor = (ratio: number): Pace["status"] => (ratio >= 1.05 ? "ahead" : ratio >= 0.95 ? "on_pace" : "behind");

export function periodBounds(period: Pace["period"], today: string): { start: string; days: number } {
  const [y, m, d] = today.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (period === "week") {
    const dow = (date.getUTCDay() + 6) % 7; // Monday = 0
    const start = new Date(date);
    start.setUTCDate(d - dow);
    return { start: iso(start), days: 7 };
  }
  if (period === "month") return { start: iso(new Date(Date.UTC(y, m - 1, 1))), days: new Date(Date.UTC(y, m, 0)).getUTCDate() };
  if (period === "quarter") {
    const q = Math.floor((m - 1) / 3) * 3;
    const s = new Date(Date.UTC(y, q, 1));
    const e = new Date(Date.UTC(y, q + 3, 1));
    return { start: iso(s), days: Math.round((+e - +s) / 86400000) };
  }
  const s = new Date(Date.UTC(y, 0, 1));
  return { start: iso(s), days: Math.round((+new Date(Date.UTC(y + 1, 0, 1)) - +s) / 86400000) };
}

const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000);

export function periodWord(p: Pace["period"]) {
  return { week: "this week", month: "this month", quarter: "this quarter", year: "this year" }[p];
}
