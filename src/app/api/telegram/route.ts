import { ask } from "@/lib/ask";
import { safeEqual, telegramSecret } from "@/lib/auth";
import { secret } from "@/lib/deliver";
import { json } from "@/lib/http";
import { sendReport } from "@/lib/send";
import { loadState, updateState } from "@/lib/store";

/**
 * Telegram sends every message to the member's bot here.
 * The first chat to message the bot after "Connect Telegram" becomes the owner chat;
 * after that, messages from anyone else are ignored.
 */
export async function POST(req: Request) {
  const got = req.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!safeEqual(got, telegramSecret())) return json({ error: "Not allowed" }, 401);
  const update = await req.json().catch(() => null);
  const msg = update?.message;
  if (!msg?.chat?.id || typeof msg.text !== "string") return json({ ok: true });

  const chatId = String(msg.chat.id);
  let state = await loadState();
  const token = secret("TELEGRAM_BOT_TOKEN", state.connections);
  if (!token) return json({ ok: true });
  const reply = (text: string) =>
    fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });

  const owner = secret("TELEGRAM_CHAT_ID", state.connections);
  if (!owner) {
    state = await updateState((s) => { s.connections.TELEGRAM_CHAT_ID = chatId; });
    await reply("Connected. Your reports will arrive here, and you can ask me about your numbers any time.");
    return json({ ok: true });
  }
  if (owner !== chatId) return json({ ok: true });

  const text = msg.text.trim();
  try {
    if (/^\/(report|start)\b/i.test(text)) {
      const res = await sendReport();
      if (!res.ok) await reply(`I couldn't send the report: ${res.detail}`);
    } else {
      await reply(await ask(state, text));
    }
  } catch (e) {
    await reply(`Something went wrong: ${(e as Error).message}`);
  }
  return json({ ok: true });
}
