import { json, owner } from "@/lib/http";
import { buildViews } from "@/lib/metrics";
import { buildReport } from "@/lib/report";
import { sendReport } from "@/lib/send";
import { loadState } from "@/lib/store";

/** GET previews the report. POST sends it now (the "Send test report" button). */
export async function GET(req: Request) {
  return owner(async () => {
    const { settings, views } = await buildViews(await loadState());
    return json(buildReport(settings, views, new URL(req.url).origin));
  });
}

export async function POST(req: Request) {
  return owner(async () => {
    const res = await sendReport(new URL(req.url).origin);
    return json(res, res.ok ? 200 : 502);
  });
}
