import "server-only";
import { deliver } from "./deliver";
import { buildViews } from "./metrics";
import { buildReport, siteUrl } from "./report";
import { loadState, updateState } from "./store";

/** Build the report from live data and send it on the member's channel. Records the result. */
export async function sendReport(origin?: string): Promise<{ ok: boolean; detail: string; text: string }> {
  const state = await loadState();
  const { settings, views } = await buildViews(state);
  const report = buildReport(settings, views, siteUrl(origin));
  let ok = true;
  let detail: string;
  try {
    detail = await deliver(settings, state.connections, report);
  } catch (e) {
    ok = false;
    detail = (e as Error).message;
  }
  await updateState((s) => { s.lastReport = { at: new Date().toISOString(), ok, detail }; });
  return { ok, detail, text: report.text };
}
