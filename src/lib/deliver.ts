import "server-only";
import type { Channel, Connections, Settings } from "./types";

/** A saved connection from the Setup page, or the same name set as an environment variable. */
export function secret(name: string, connections: Connections): string | undefined {
  return process.env[name]?.trim() || connections[name]?.trim() || undefined;
}

export const channelNeeds: Record<Channel, string[]> = {
  email: ["RESEND_API_KEY"],
  slack: ["SLACK_WEBHOOK_URL"],
  teams: ["TEAMS_WEBHOOK_URL"],
  google_chat: ["GOOGLE_CHAT_WEBHOOK_URL"],
  telegram: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"],
};

export function channelReady(settings: Settings, connections: Connections): { ready: boolean; missing: string[] } {
  const missing = channelNeeds[settings.channel].filter((n) => !secret(n, connections));
  if (settings.channel === "email" && !settings.reportEmail) missing.push("your email address in settings");
  return { ready: missing.length === 0, missing };
}

export async function deliver(settings: Settings, connections: Connections, report: { subject: string; text: string }): Promise<string> {
  const s = (n: string) => secret(n, connections);
  const { ready, missing } = channelReady(settings, connections);
  if (!ready) throw new Error(`Missing: ${missing.join(", ")}`);

  switch (settings.channel) {
    case "email": {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${s("RESEND_API_KEY")}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: s("REPORT_FROM") ?? "AI Analyst <onboarding@resend.dev>",
          to: [settings.reportEmail],
          subject: report.subject,
          text: report.text,
          html: `<pre style="font:14px/1.5 ui-monospace,Menlo,monospace;white-space:pre-wrap">${escapeHtml(report.text)}</pre>`,
        }),
      });
      return check(res, "Email");
    }
    case "slack":
      return check(await post(s("SLACK_WEBHOOK_URL")!, { text: "```" + report.text + "```" }), "Slack");
    case "google_chat":
      return check(await post(s("GOOGLE_CHAT_WEBHOOK_URL")!, { text: "```" + report.text + "```" }), "Google Chat");
    case "teams":
      // Teams Workflows webhooks expect an Adaptive Card.
      return check(
        await post(s("TEAMS_WEBHOOK_URL")!, {
          type: "message",
          attachments: [
            {
              contentType: "application/vnd.microsoft.card.adaptive",
              content: {
                $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
                type: "AdaptiveCard",
                version: "1.4",
                body: [
                  { type: "TextBlock", text: report.subject, weight: "Bolder", size: "Medium", wrap: true },
                  { type: "TextBlock", text: report.text.split("\n").slice(1).join("\n\n"), wrap: true, fontType: "Monospace" },
                ],
              },
            },
          ],
        }),
        "Teams",
      );
    case "telegram":
      return check(
        await post(`https://api.telegram.org/bot${s("TELEGRAM_BOT_TOKEN")}/sendMessage`, {
          chat_id: s("TELEGRAM_CHAT_ID"),
          text: report.text,
          disable_web_page_preview: true,
        }),
        "Telegram",
      );
  }
}

const post = (url: string, body: unknown) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

async function check(res: Response, label: string): Promise<string> {
  if (res.ok) return `${label}: sent`;
  const detail = (await res.text().catch(() => "")).slice(0, 200);
  throw new Error(`${label} said ${res.status}${detail ? `: ${detail}` : ""}`);
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
