import { ingestToken, passcode, safeEqual } from "@/lib/auth";
import { mergePoints, toDate, toNumber } from "@/lib/csv";
import { json } from "@/lib/http";
import { exampleSettings } from "@/lib/sample";
import { updateState } from "@/lib/store";

/**
 * The drop-off address. Make, Zapier, n8n or a scheduled Claude or ChatGPT task POSTs KPI values here,
 * so KPIs from tools the starter does not connect to still update themselves.
 *
 * Body, one value:   { "kpi": "Website visitors", "date": "2026-10-16", "value": 4212 }
 * Body, many values: { "values": [ { "kpi": "revenue", "date": "2026-10-16", "value": 12480 }, ... ] }
 * "kpi" is the KPI's name or id from settings. "date" defaults to today.
 */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!passcode() || !safeEqual(token, ingestToken())) return new Response("Not found", { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body) return json({ error: "Send JSON like {\"kpi\": \"Revenue\", \"date\": \"2026-10-16\", \"value\": 12480}" }, 400);
  const rows: Record<string, unknown>[] = Array.isArray(body.values) ? body.values : [body];
  if (rows.length > 500) return json({ error: "Send 500 values or fewer at a time." }, 400);

  const saved: string[] = [];
  const problems: string[] = [];
  await updateState((s) => {
    const kpis = (s.settings ?? exampleSettings).kpis;
    const tz = s.settings?.timezone ?? "UTC";
    const now = new Date().toISOString();
    for (const r of rows) {
      const label = String(r.kpi ?? "").trim().toLowerCase();
      const kpi = kpis.find((k) => k.id === label || k.name.toLowerCase() === label);
      const value = toNumber(String(r.value ?? ""));
      const date = r.date ? toDate(String(r.date)) : new Date().toLocaleDateString("en-CA", { timeZone: tz });
      if (!kpi) { problems.push(`No KPI called "${r.kpi}"`); continue; }
      if (value === null || !date) { problems.push(`${kpi.name}: needs a number and a date`); continue; }
      s.data[kpi.id] = mergePoints(s.data[kpi.id], [{ date, value }]);
      s.updated[kpi.id] = now;
      saved.push(`${kpi.name} ${date} ${value}`);
    }
  });
  return json({ saved, problems }, saved.length ? 200 : 400);
}
