import type { Connections, Kpi, Point } from "../types";
import { csvUrl } from "./csv-url";

/**
 * A source returns the full history it can see for one KPI.
 * Manual numbers are stored by the app itself and need no source code.
 *
 * To add a tool (Stripe, HubSpot, a database...), copy csv-url.ts, fetch the
 * numbers with the tool's read-only API key from `connections`, return points,
 * and register it below. The key is saved on the Setup page, never in code.
 */
export type SourceFn = (kpi: Kpi, connections: Connections) => Promise<Point[]>;

export const sources: Record<string, { label: string; fetch?: SourceFn }> = {
  manual: { label: "Typed or uploaded" },
  csv_url: { label: "Spreadsheet link", fetch: csvUrl },
};

export function sourceLabel(kpi: Kpi) {
  return sources[kpi.source.type]?.label ?? kpi.source.type;
}
