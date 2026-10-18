import { telegramSecret } from "@/lib/auth";
import { secret } from "@/lib/deliver";
import { json, owner } from "@/lib/http";
import { loadState, updateState } from "@/lib/store";

/** Points the member's Telegram bot at this app. Pressed once from the Setup page. */
export async function POST(req: Request) {
  return owner(async () => {
    const state = await loadState();
    const token = secret("TELEGRAM_BOT_TOKEN", state.connections);
    if (!token) return json({ error: "Save your bot token first." }, 400);
    const url = `${new URL(req.url).origin}/api/telegram`;
    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, secret_token: telegramSecret(), allowed_updates: ["message"] }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) return json({ error: `Telegram said: ${data.description ?? res.status}` }, 502);
    await updateState((s) => { delete s.connections.TELEGRAM_CHAT_ID; });
    return json({ ok: true });
  });
}
