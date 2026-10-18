import type { Point } from "../types";

/** How far back each connection reads. Enough for this quarter's pacing and a 30-day trend. */
export const LOOKBACK_DAYS = 100;

export const sinceDate = (days = LOOKBACK_DAYS) => new Date(Date.now() - days * 86400000);

/** Day (YYYY-MM-DD) of a timestamp in the member's time zone. */
export function dayOf(when: Date | string | number, timezone = "UTC"): string {
  const d = typeof when === "number" ? new Date(when) : new Date(when);
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(d);
}

/** Add values into daily buckets, and fill missing days with 0 so totals and trends are honest. */
export function bucket(items: { day: string; value: number }[], fillFrom?: string): Point[] {
  const map = new Map<string, number>();
  for (const it of items) map.set(it.day, (map.get(it.day) ?? 0) + it.value);
  if (fillFrom) {
    const end = new Date();
    for (let d = new Date(fillFrom + "T00:00:00Z"); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
      const k = d.toISOString().slice(0, 10);
      if (!map.has(k)) map.set(k, 0);
    }
  }
  return [...map.entries()].map(([date, value]) => ({ date, value: Math.round(value * 100) / 100 })).sort((a, b) => a.date.localeCompare(b.date));
}

export async function getJson(url: string, init: RequestInit, label: string) {
  const res = await fetch(url, { ...init, cache: "no-store" });
  if (!res.ok) {
    const body = (await res.text().catch(() => "")).slice(0, 160);
    if (res.status === 401 || res.status === 403) throw new Error(`${label} refused the key (${res.status}). Check it is the right key and has read access.`);
    throw new Error(`${label} said ${res.status}${body ? `: ${body}` : ""}`);
  }
  return { data: await res.json(), headers: res.headers };
}
