import { mergePoints, parseCsv, tableToPoints, toDate, toNumber } from "@/lib/csv";
import { json, owner } from "@/lib/http";
import { exampleSettings } from "@/lib/sample";
import { updateState } from "@/lib/store";

/** Add one number, or upload a table (CSV text) of many. */
export async function POST(req: Request) {
  return owner(async () => {
    const body = await req.json();
    let added = 0;
    let skipped = 0;
    let matched: string[] = [];
    let problem: string | null = null;
    await updateState((s) => {
      const kpis = (s.settings ?? exampleSettings).kpis;
      const now = new Date().toISOString();
      if (typeof body.csv === "string") {
        const res = tableToPoints(parseCsv(body.csv), kpis, body.kpiId || undefined);
        skipped = res.skipped;
        matched = res.matched;
        for (const [id, pts] of Object.entries(res.points)) {
          s.data[id] = mergePoints(s.data[id], pts);
          s.updated[id] = now;
          added += pts.length;
        }
        if (added === 0) problem = "No rows matched. Use a date column plus a column named after each KPI, or pick one KPI and upload date and value.";
      } else {
        const kpi = kpis.find((k) => k.id === body.kpiId);
        const date = toDate(String(body.date ?? "")) ?? new Date().toISOString().slice(0, 10);
        const value = toNumber(String(body.value ?? ""));
        if (!kpi) problem = "Pick a KPI.";
        else if (value === null) problem = "Type a number, like 12480 or 3.5.";
        else {
          s.data[kpi.id] = mergePoints(s.data[kpi.id], [{ date, value }]);
          s.updated[kpi.id] = now;
          added = 1;
          matched = [kpi.id];
        }
      }
    });
    return problem ? json({ error: problem, skipped }, 400) : json({ ok: true, added, skipped, matched });
  });
}

/** Clear one KPI's numbers so it goes back to sample values. */
export async function DELETE(req: Request) {
  return owner(async () => {
    const { kpiId } = await req.json();
    await updateState((s) => { delete s.data[kpiId]; delete s.updated[kpiId]; });
    return json({ ok: true });
  });
}
