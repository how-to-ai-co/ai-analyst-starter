import { json, owner } from "@/lib/http";
import { parseSettings } from "@/lib/settings";
import { notifyOwner } from "@/lib/notify";
import { loadState, updateState } from "@/lib/store";

export async function POST(req: Request) {
  return owner(async () => {
    const { text } = await req.json();
    const parsed = parseSettings(text);
    if (!parsed.ok) return json({ error: parsed.error }, 400);
    const before = await loadState();
    const old = before.settings;
    await updateState((s) => { s.settings = parsed.settings; });
    if (old && (old.channel !== parsed.settings.channel || old.reportEmail !== parsed.settings.reportEmail)) {
      await notifyOwner(before, `Reports moved from ${old.channel}${old.reportEmail ? ` (${old.reportEmail})` : ""} to ${parsed.settings.channel}${parsed.settings.reportEmail ? ` (${parsed.settings.reportEmail})` : ""} at ${new Date().toUTCString()}.`);
    }
    return json({ ok: true, settings: parsed.settings });
  });
}
