import { parseCsv, toDate, toNumber } from "../csv";
import type { Kpi, Point } from "../types";

/**
 * Reads a CSV link: a Google Sheet published as CSV, an Excel or OneDrive CSV link,
 * or any tool's export URL. Columns: a date column and a value column.
 * Settings: { "type": "csv_url", "url": "...", "dateColumn": "Date", "valueColumn": "Revenue" }
 */
export async function csvUrl(kpi: Kpi): Promise<Point[]> {
  const src = kpi.source as { url?: string; dateColumn?: string; valueColumn?: string };
  if (!src.url || !/^https:\/\//.test(src.url)) throw new Error("Add an https link to a CSV file");
  const res = await fetch(src.url, { cache: "no-store", redirect: "follow" });
  if (!res.ok) throw new Error(`The link answered ${res.status}`);
  const rows = parseCsv(await res.text());
  if (rows.length < 2) throw new Error("The link has no rows");
  const header = rows[0].map((h) => h.toLowerCase());
  const pick = (want: string | undefined, fallback: number) => {
    if (!want) return fallback;
    const i = header.indexOf(want.toLowerCase());
    if (i === -1) throw new Error(`No column called "${want}"`);
    return i;
  };
  const dateCol = pick(src.dateColumn, Math.max(0, header.findIndex((h) => /date|day|week|month/.test(h))));
  const valueCol = pick(src.valueColumn, dateCol === 0 ? 1 : 0);
  const out: Point[] = [];
  for (const r of rows.slice(1)) {
    const d = toDate(r[dateCol]);
    const v = toNumber(r[valueCol]);
    if (d && v !== null) out.push({ date: d, value: v });
  }
  if (out.length === 0) throw new Error("Found no rows with a date and a number");
  return out.sort((a, b) => a.date.localeCompare(b.date));
}
