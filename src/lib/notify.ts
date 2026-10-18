import "server-only";
import { secret } from "./deliver";
import type { State } from "./types";

/**
 * Emails the owner when someone changes where reports go, so a guessed passcode can't quietly
 * redirect their KPIs. Uses the email address and Resend key already saved; skips if there are none.
 */
export async function notifyOwner(state: State, what: string): Promise<void> {
  const to = state.settings?.reportEmail;
  const key = secret("RESEND_API_KEY", state.connections);
  if (!to || !key) return;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: secret("REPORT_FROM", state.connections) ?? "AI Analyst <onboarding@resend.dev>",
      to: [to],
      subject: "Your AI analyst's report settings changed",
      text: `${what}\n\nIf this wasn't you, change DASHBOARD_PASSCODE in your host's environment variables and redeploy, then check Setup.`,
    }),
  }).catch(() => undefined);
}
