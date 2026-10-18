import { json, owner } from "@/lib/http";
import { notifyOwner } from "@/lib/notify";
import { loadState, updateState } from "@/lib/store";

const NAME = /^[A-Z][A-Z0-9_]{2,40}$/;

/** Save a key or webhook link from the Setup page. Values are never sent back to the browser. */
export async function POST(req: Request) {
  return owner(async () => {
    const { name, value } = await req.json();
    if (!NAME.test(String(name))) return json({ error: "Names look like SLACK_WEBHOOK_URL." }, 400);
    const v = String(value ?? "").trim();
    if (!v) return json({ error: "Paste the value first." }, 400);
    if (v.length > 2000) return json({ error: "That value is too long." }, 400);
    if (/WEBHOOK_URL$/.test(name) && !/^https:\/\//.test(v)) return json({ error: "Webhook links start with https://" }, 400);
    if (name === "VIEWER_PASSCODE" && v.length < 10) return json({ error: "Make the view-only passcode 10 characters or more." }, 400);
    if (name === "VIEWER_PASSCODE" && v === process.env.DASHBOARD_PASSCODE?.trim()) return json({ error: "Use a different passcode from your own." }, 400);
    const before = await loadState();
    await updateState((s) => { s.connections[name] = v; });
    if (/WEBHOOK_URL$|^TELEGRAM_BOT_TOKEN$|^REPORT_FROM$/.test(name) && before.connections[name]) {
      await notifyOwner(before, `${name} was replaced at ${new Date().toUTCString()}. Your reports now go to the new destination.`);
    }
    return json({ ok: true });
  });
}

export async function DELETE(req: Request) {
  return owner(async () => {
    const { name } = await req.json();
    await updateState((s) => { delete s.connections[name]; });
    return json({ ok: true });
  });
}
