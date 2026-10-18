import { createHmac } from "node:crypto";
import { after } from "next/server";
import { ask } from "@/lib/ask";
import { safeEqual } from "@/lib/auth";
import { secret } from "@/lib/deliver";
import { json } from "@/lib/http";
import { sendReport } from "@/lib/send";
import { loadState } from "@/lib/store";

/**
 * The Slack bot. Slack sends @mentions and direct messages here; the bot answers in the thread
 * using the same read-only KPI tools as the dashboard. Needs SLACK_BOT_TOKEN and SLACK_SIGNING_SECRET
 * (saved on Setup) plus an Anthropic or OpenAI key for the answers.
 * Only people in SLACK_ALLOWED_USERS (comma-separated Slack user IDs) get answers when it is set;
 * otherwise anyone in the channels the bot was invited to can ask.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const state = await loadState();
  const signing = secret("SLACK_SIGNING_SECRET", state.connections);
  if (!signing) {
    // Slack checks the address once while the app is being created, before the member can save the
    // signing secret. Echoing that one-time challenge reveals nothing; every real event is refused.
    const first = JSON.parse(raw || "{}");
    if (first.type === "url_verification") return json({ challenge: first.challenge });
    return json({ error: "Save SLACK_SIGNING_SECRET on Setup first." }, 401);
  }

  const ts = req.headers.get("x-slack-request-timestamp") ?? "";
  const sig = req.headers.get("x-slack-signature") ?? "";
  if (!ts || Math.abs(Date.now() / 1000 - Number(ts)) > 300) return json({ error: "Stale request" }, 401);
  const expected = "v0=" + createHmac("sha256", signing).update(`v0:${ts}:${raw}`).digest("hex");
  if (!safeEqual(sig, expected)) return json({ error: "Bad signature" }, 401);

  const body = JSON.parse(raw);
  if (body.type === "url_verification") return json({ challenge: body.challenge });
  if (req.headers.get("x-slack-retry-num")) return json({ ok: true }); // Slack retries if we were slow; we already answered

  const ev = body.event ?? {};
  const isAsk = ev.type === "app_mention" || (ev.type === "message" && ev.channel_type === "im");
  if (!isAsk || ev.bot_id || ev.subtype) return json({ ok: true });

  const allowed = (secret("SLACK_ALLOWED_USERS", state.connections) ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const token = secret("SLACK_BOT_TOKEN", state.connections);
  const question = String(ev.text ?? "").replace(/<@[A-Z0-9]+>/g, "").trim();

  // Answer after replying 200, because Slack only waits 3 seconds.
  after(async () => {
    if (!token) return;
    const reply = (text: string) =>
      fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({ channel: ev.channel, thread_ts: ev.thread_ts ?? ev.ts, text }),
      });
    if (allowed.length && !allowed.includes(ev.user)) return void (await reply("Sorry, I only answer the people my owner has allowed."));
    try {
      if (!question || /^(report|send report)$/i.test(question)) {
        const res = await sendReport();
        if (!res.ok) await reply(`I couldn't send the report: ${res.detail}`);
        return;
      }
      await reply(await ask(await loadState(), question));
    } catch (e) {
      await reply(`Something went wrong: ${(e as Error).message}`);
    }
  });
  return json({ ok: true });
}
