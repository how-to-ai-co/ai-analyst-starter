import type { Kpi, Point, Settings } from "./types";

/** Plausible sample numbers so the dashboard works before any data is connected. */
export function samplePoints(kpi: Kpi, days = 45): Point[] {
  const seed = [...kpi.id].reduce((a, c) => a + c.charCodeAt(0), 0);
  const rand = mulberry32(seed);
  const base = guessBase(kpi);
  const drift = (rand() - 0.35) * 0.006;
  const out: Point[] = [];
  const today = new Date();
  let v = base;
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    v = v * (1 + drift + (rand() - 0.5) * 0.06);
    const value = kpi.format === "percent" ? round(Math.max(0, v), 1) : Math.max(0, Math.round(v));
    out.push({ date: d.toISOString().slice(0, 10), value });
  }
  return out;
}

function guessBase(kpi: Kpi): number {
  const n = kpi.name.toLowerCase();
  if (kpi.format === "percent") return /churn|no-show|denial|bounce/.test(n) ? 2.5 : 24;
  if (kpi.format === "currency") return /cash|pipeline|volume/.test(n) ? 185000 : /order value|deal size/.test(n) ? 320 : /spend|cost/.test(n) ? 900 : 12400;
  if (/hour/.test(n)) return 120;
  if (/visit|traffic|subscriber|follower|user/.test(n)) return 4200;
  return 40;
}

const round = (x: number, d: number) => Math.round(x * 10 ** d) / 10 ** d;

function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Used until the member pastes their own settings. */
export const exampleSettings: Settings = {
  name: "My KPIs",
  comparison: "last_week",
  timezone: "America/New_York",
  reportHour: 8,
  reportDays: "weekdays",
  channel: "email",
  sensitivity: "private",
  accent: "#ff6719",
  kpis: [
    { id: "revenue", name: "Revenue", format: "currency", currency: "USD", goodWhen: "up", source: { type: "manual" } },
    { id: "new_customers", name: "New customers", format: "number", goodWhen: "up", source: { type: "manual" } },
    { id: "churn", name: "Churn", format: "percent", goodWhen: "down", source: { type: "manual" } },
  ],
};
