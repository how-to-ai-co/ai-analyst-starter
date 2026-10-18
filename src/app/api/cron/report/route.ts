import { safeEqual } from "@/lib/auth";
import { json } from "@/lib/http";
import { dueToday } from "@/lib/report";
import { sendReport } from "@/lib/send";
import { loadState } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * Called by the host's scheduler.
 *   Vercel: once a day from vercel.json (mode=daily). Sends if today is a report day.
 *   Netlify: every hour from netlify/functions/report.mts (mode=hourly). Sends at the chosen local hour.
 * Sends at most once per local day, so an extra call cannot spam the member.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  const fromScheduler = /vercel-cron/i.test(req.headers.get("user-agent") ?? "") || req.headers.get("x-analyst-scheduler") === "netlify";
  if (secret ? !safeEqual(auth, `Bearer ${secret}`) && url.searchParams.get("key") !== secret : !fromScheduler) {
    return json({ error: "Not allowed" }, 401);
  }

  const state = await loadState();
  if (!state.settings) return json({ skipped: "No settings yet" });
  const { dayOk, hourOk, localDate } = dueToday(state.settings);
  const mode = url.searchParams.get("mode") ?? "daily";
  if (!dayOk) return json({ skipped: "Not a report day" });
  if (mode === "hourly" && !hourOk) return json({ skipped: "Not the report hour" });
  const last = state.lastReport;
  if (last?.ok && dueToday(state.settings, new Date(last.at)).localDate === localDate) return json({ skipped: "Already sent today" });

  const res = await sendReport();
  return json(res, res.ok ? 200 : 502);
}
