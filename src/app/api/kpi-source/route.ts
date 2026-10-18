import { json, owner } from "@/lib/http";
import { updateState } from "@/lib/store";

/** Switch one KPI between typed-in numbers and a spreadsheet link. */
export async function POST(req: Request) {
  return owner(async () => {
    const { kpiId, url, dateColumn, valueColumn } = await req.json();
    let error: string | null = null;
    await updateState((s) => {
      const kpi = s.settings?.kpis.find((k) => k.id === kpiId);
      if (!kpi) { error = "Save your settings first, then link a spreadsheet."; return; }
      if (!url) { kpi.source = { type: "manual" }; return; }
      if (!/^https:\/\//.test(String(url))) { error = "Use the https link to the CSV."; return; }
      kpi.source = { type: "csv_url", url: String(url).trim(), dateColumn: dateColumn || undefined, valueColumn: valueColumn || undefined };
    });
    return error ? json({ error }, 400) : json({ ok: true });
  });
}
