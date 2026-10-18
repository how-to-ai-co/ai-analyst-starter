import type { Settings } from "./types";

/** Checks settings pasted from the AI (or edited by hand) and fills in safe defaults. */
export function parseSettings(input: unknown): { ok: true; settings: Settings } | { ok: false; error: string } {
  let raw: Record<string, unknown>;
  try {
    raw = typeof input === "string" ? JSON.parse(extractJson(input)) : (input as Record<string, unknown>);
  } catch {
    return { ok: false, error: "That isn't valid settings text. Copy the whole block your AI gave you, from { to }." };
  }
  if (!raw || typeof raw !== "object") return { ok: false, error: "Settings are empty." };
  const kpisIn = Array.isArray(raw.kpis) ? raw.kpis : [];
  if (kpisIn.length === 0) return { ok: false, error: "Add at least one KPI." };
  if (kpisIn.length > 12) return { ok: false, error: "Keep it to 12 KPIs or fewer." };

  const seen = new Set<string>();
  const kpis = kpisIn.map((k: Record<string, unknown>, i: number) => {
    const name = String(k.name ?? `KPI ${i + 1}`).slice(0, 60);
    let id = slug(String(k.id ?? name)) || `kpi_${i + 1}`;
    while (seen.has(id)) id += "_2";
    seen.add(id);
    const format = ["number", "currency", "percent"].includes(String(k.format)) ? (k.format as Settings["kpis"][number]["format"]) : "number";
    const source = k.source && typeof k.source === "object" && "type" in (k.source as object) ? (k.source as Settings["kpis"][number]["source"]) : { type: "manual" };
    return {
      id,
      name,
      format,
      currency: typeof k.currency === "string" ? k.currency.toUpperCase().slice(0, 3) : format === "currency" ? "USD" : undefined,
      goodWhen: k.goodWhen === "down" ? ("down" as const) : ("up" as const),
      target: typeof k.target === "number" ? k.target : toNum(k.target),
      targetPeriod: ["week", "month", "quarter", "year"].includes(String(k.targetPeriod)) ? (k.targetPeriod as "week" | "month" | "quarter" | "year") : toNum(k.target) !== undefined || typeof k.target === "number" ? ("month" as const) : undefined,
      aggregate: k.aggregate === "sum" || k.aggregate === "latest" ? (k.aggregate as "sum" | "latest") : guessAggregate(name, format),
      source,
      publicSafe: k.publicSafe === true,
    };
  });

  const comparison = ["yesterday", "last_week", "last_month", "target"].includes(String(raw.comparison)) ? (raw.comparison as Settings["comparison"]) : "last_week";
  const channel = ["email", "slack", "teams", "google_chat", "telegram"].includes(String(raw.channel)) ? (raw.channel as Settings["channel"]) : "email";
  const timezone = validTz(String(raw.timezone ?? "")) ? String(raw.timezone) : "UTC";
  const hour = Number(raw.reportHour);
  const accent = typeof raw.accent === "string" && /^#[0-9a-f]{6}$/i.test(raw.accent) ? raw.accent : "#ff6719";

  return {
    ok: true,
    settings: {
      name: String(raw.name ?? "My KPIs").slice(0, 60),
      comparison,
      timezone,
      reportHour: Number.isInteger(hour) && hour >= 0 && hour < 24 ? hour : 8,
      reportDays: ["weekdays", "daily", "mondays"].includes(String(raw.reportDays)) ? (raw.reportDays as Settings["reportDays"]) : "weekdays",
      channel,
      reportEmail: typeof raw.reportEmail === "string" && /.+@.+\..+/.test(raw.reportEmail) ? raw.reportEmail.trim() : undefined,
      sensitivity: ["private", "team", "public_safe"].includes(String(raw.sensitivity)) ? (raw.sensitivity as Settings["sensitivity"]) : "private",
      accent,
      kpis,
    },
  };
}

const toNum = (v: unknown) => {
  if (typeof v !== "string") return undefined;
  const n = Number(v.replace(/[$£€,%\s]/g, ""));
  return Number.isFinite(n) && v.trim() !== "" ? n : undefined;
};

/** Running totals add up day by day; balances and rates are read as their latest value. */
function guessAggregate(name: string, format: string): "sum" | "latest" {
  if (format === "percent") return "latest";
  return /cash|balance|pipeline|subscriber|follower|headcount|backlog|open |active|mrr|arr|average|avg|rate|time|score/i.test(name) ? "latest" : "sum";
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);

function validTz(tz: string) {
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return tz.length > 0; } catch { return false; }
}

/** Pull the first {...} block out of text that may include an AI's explanation around it. */
function extractJson(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return start !== -1 && end > start ? text.slice(start, end + 1) : text;
}
