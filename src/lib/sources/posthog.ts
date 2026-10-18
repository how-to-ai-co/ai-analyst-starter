import type { Connections, Kpi, Point } from "../types";
import { bucket, getJson, LOOKBACK_DAYS } from "./util";

/**
 * PostHog. Needs a personal API key with read access to query, saved as POSTHOG_API_KEY.
 * source: { "type": "posthog", "project": "12345", "event": "$pageview", "metric": "count" | "unique_users", "host": "https://us.posthog.com" }
 */
export async function posthog(kpi: Kpi, connections: Connections, timezone = "UTC"): Promise<Point[]> {
  const key = connections.POSTHOG_API_KEY || process.env.POSTHOG_API_KEY;
  if (!key) throw new Error("Save your PostHog personal API key (POSTHOG_API_KEY) on Setup");
  const src = kpi.source as { project?: string | number; event?: string; metric?: string; host?: string };
  const project = String(src.project ?? connections.POSTHOG_PROJECT_ID ?? "");
  if (!/^\d+$/.test(project)) throw new Error("Add your PostHog project number to this KPI's settings");
  const event = String(src.event ?? "$pageview");
  if (!/^[\w$ .:/-]{1,100}$/.test(event)) throw new Error("That event name has characters PostHog queries can't use");
  const host = /^https:\/\/[a-z0-9.-]+$/i.test(String(src.host ?? "")) ? String(src.host) : "https://us.posthog.com";
  const tz = /^[A-Za-z_]+\/[A-Za-z_]+$/.test(timezone) ? timezone : "UTC";
  const measure = src.metric === "unique_users" ? "count(DISTINCT person_id)" : "count()";
  const query = `SELECT toDate(toTimeZone(timestamp, '${tz}')) AS day, ${measure} AS value FROM events WHERE event = '${event.replace(/'/g, "")}' AND timestamp >= now() - INTERVAL ${LOOKBACK_DAYS} DAY GROUP BY day ORDER BY day`;
  const { data } = await getJson(
    `${host}/api/projects/${project}/query/`,
    { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: { kind: "HogQLQuery", query } }) },
    "PostHog",
  );
  return posthogToPoints(data.results ?? []);
}

export function posthogToPoints(rows: [string, number][]): Point[] {
  return bucket(rows.map(([day, value]) => ({ day: String(day).slice(0, 10), value: Number(value) })));
}
