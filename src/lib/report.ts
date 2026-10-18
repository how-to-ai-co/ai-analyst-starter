import "server-only";
import { changeText, formatValue, paceText, timeAgo } from "./format";
import type { KpiView, Settings } from "./types";

export function siteUrl(origin?: string): string {
  if (origin) return origin;
  if (process.env.SITE_URL) return process.env.SITE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.URL) return process.env.URL; // Netlify
  return "http://localhost:3000";
}

/** The morning message, the same shape the member approved in the preview. */
export function buildReport(settings: Settings, views: KpiView[], link: string): { subject: string; text: string } {
  const today = new Intl.DateTimeFormat("en-US", { timeZone: settings.timezone, weekday: "short", day: "numeric", month: "short" }).format(new Date());
  const width = Math.max(...views.map((v) => v.name.length), 8) + 2;
  const lines = views.map((v) => {
    const value = formatValue(v.value, v.format, v.currency);
    const notes = [v.sample ? "sample" : null, v.stale ? `last updated ${timeAgo(v.updatedAt)}` : null, v.error ? "could not refresh" : null].filter(Boolean);
    return `${v.name.padEnd(width)}${value.padEnd(12)}${changeText(v, settings.comparison)}${notes.length ? `  (${notes.join(", ")})` : ""}`;
  });
  const paces = views.filter((v) => v.pace).map((v) => `${v.name}: ${paceText(v)}`);
  const anySample = views.some((v) => v.sample);
  const text = [
    `${settings.name} for ${today}`,
    "",
    ...lines,
    "",
    ...(paces.length ? ["Targets", ...paces, ""] : []),
    anySample ? "Numbers marked sample are placeholders until you connect or add your own." : null,
    `Dashboard: ${link}`,
  ].filter((l) => l !== null).join("\n");
  return { subject: `${settings.name}: ${today}`, text };
}

/** Is it time to send, in the member's own time zone? */
export function dueToday(settings: Settings, now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: settings.timezone, weekday: "short", hour: "numeric", hour12: false, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const day = parts.weekday as string;
  const dayOk = settings.reportDays === "daily" || (settings.reportDays === "weekdays" ? !["Sat", "Sun"].includes(day) : day === "Mon");
  const localDate = `${parts.year}-${parts.month}-${parts.day}`;
  const hour = Number(parts.hour) % 24;
  return { dayOk, hourOk: hour === settings.reportHour, localDate };
}

/** The UTC cron line for vercel.json that matches the member's chosen local hour today. */
export function utcCronFor(settings: Settings): string {
  const now = new Date();
  const local = Number(new Intl.DateTimeFormat("en-US", { timeZone: settings.timezone, hour: "numeric", hour12: false }).format(now)) % 24;
  const offset = local - now.getUTCHours();
  const utc = (((settings.reportHour - offset) % 24) + 24) % 24;
  return `0 ${utc} * * *`;
}
