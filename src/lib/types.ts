export type Format = "number" | "currency" | "percent";
export type Comparison = "yesterday" | "last_week" | "last_month" | "target";
export type Channel = "email" | "slack" | "teams" | "google_chat" | "telegram";

/** Where a KPI's numbers come from. Add new types in src/lib/sources/. */
export type Source =
  | { type: "manual" } // typed in or uploaded on the Numbers page
  | { type: "csv_url"; url: string; dateColumn?: string; valueColumn?: string } // a published Google Sheet, Excel or tool export link
  | { type: string; [key: string]: unknown }; // custom sources written later

export type Kpi = {
  id: string; // short slug, e.g. "revenue"
  name: string; // "Revenue"
  format: Format;
  currency?: string; // "USD"
  goodWhen?: "up" | "down"; // churn and costs are good when they go down
  target?: number; // the goal for the period below
  targetPeriod?: "week" | "month" | "quarter" | "year";
  /** "sum": each day adds up (revenue, signups). "latest": the newest value is the number (churn %, cash, pipeline). */
  aggregate?: "sum" | "latest";
  source: Source;
  publicSafe?: boolean;
};

export type Settings = {
  name: string; // "Acme KPIs"
  comparison: Comparison;
  timezone: string; // IANA, e.g. "America/New_York"
  reportHour: number; // 0-23 in the member's time zone
  reportDays: "weekdays" | "daily" | "mondays";
  channel: Channel;
  reportEmail?: string;
  sensitivity: "private" | "team" | "public_safe";
  accent?: string; // hex colour for the dashboard
  kpis: Kpi[];
};

export type Point = { date: string; value: number }; // date as YYYY-MM-DD

/** Secrets saved from the Setup page. Never sent to the browser. */
export type Connections = Record<string, string>;

export type State = {
  version: 1;
  settings: Settings | null;
  data: Record<string, Point[]>;
  updated: Record<string, string>; // kpi id -> ISO time of last new data
  connections: Connections;
  lastReport?: { at: string; ok: boolean; detail: string };
  /** Values read from each tool, kept for 15 minutes so pages load fast. */
  cache?: Record<string, { at: string; key: string; series: Point[] }>;
  /** Wrong passcode attempts, so guessing gets locked out. */
  security?: { fails: number; lockedUntil?: string };
  cacheDirty?: boolean; // in memory only, never saved
};

export type KpiView = {
  id: string;
  name: string;
  format: Format;
  currency?: string;
  value: number | null;
  previous: number | null;
  change: number | null; // absolute change
  changePct: number | null;
  trend: "up" | "down" | "flat" | null;
  good: boolean | null;
  series: Point[];
  sample: boolean;
  sourceLabel: string;
  updatedAt: string | null;
  stale: boolean;
  error?: string;
  pace?: Pace;
};

export type Pace = {
  target: number;
  period: "week" | "month" | "quarter" | "year";
  aggregate: "sum" | "latest";
  actual: number; // period-to-date total, or the latest value
  expected: number | null; // where a "sum" KPI should be by today
  projected: number | null; // where a "sum" KPI will land at this rate
  status: "ahead" | "on_pace" | "behind";
  pct: number; // actual as a % of target
};
