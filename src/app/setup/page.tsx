import { headers } from "next/headers";
import Link from "next/link";
import { Gate } from "@/components/gate";
import { ActionButton, CopyField, SaveConnection, SaveSettings, SignOut } from "@/components/setup-actions";
import { Shell } from "@/components/shell";
import { askReady } from "@/lib/ask";
import { ingestToken, mcpToken } from "@/lib/auth";
import { channelReady, secret } from "@/lib/deliver";
import { timeAgo } from "@/lib/format";
import { buildViews } from "@/lib/metrics";
import { utcCronFor } from "@/lib/report";
import { exampleSettings } from "@/lib/sample";
import { neededKeys } from "@/lib/sources";
import { loadState, storageKind } from "@/lib/store";
import type { Channel, Connections } from "@/lib/types";

export const dynamic = "force-dynamic";

const CHANNEL_HELP: Record<Channel, { name: string; fields: { name: string; label: string; help: string }[] }> = {
  email: { name: "Email", fields: [{ name: "RESEND_API_KEY", label: "Resend API key", help: "Sign up free at resend.com with the email address your report goes to, then API Keys, Create. Reports go to that same address." }] },
  slack: {
    name: "Slack",
    fields: [
      { name: "SLACK_BOT_TOKEN", label: "Slack bot token (starts xoxb-)", help: "After creating the app from the manifest below: Install to Workspace, then OAuth & Permissions, copy the Bot User OAuth Token." },
      { name: "SLACK_SIGNING_SECRET", label: "Slack signing secret", help: "In the same app: Basic Information, App Credentials, Signing Secret, Show, copy." },
      { name: "SLACK_CHANNEL_ID", label: "Channel ID for the morning report", help: "In Slack, open the channel (one only you are in, to start), click its name, and copy the Channel ID at the bottom. Then type /invite @AI Analyst in that channel." },
    ],
  },
  teams: { name: "Microsoft Teams", fields: [{ name: "TEAMS_WEBHOOK_URL", label: "Teams workflow link", help: "In Teams, open Workflows and choose \"Post to a chat when a webhook request is received\" (or the channel version), finish the steps and copy the link. If Workflows is missing, your IT team has switched it off; use email for now." }] },
  google_chat: { name: "Google Chat", fields: [{ name: "GOOGLE_CHAT_WEBHOOK_URL", label: "Google Chat webhook link", help: "In a space only you are in: the space name, Apps & integrations, Webhooks, Add, copy the link." }] },
  telegram: { name: "Telegram", fields: [{ name: "TELEGRAM_BOT_TOKEN", label: "Telegram bot token", help: "In Telegram, message @BotFather, send /newbot, pick a name, and paste the token it gives you." }] },
};

export default async function SetupPage() {
  return (
    <Gate>
      <Body />
    </Gate>
  );
}

async function Body() {
  const state = await loadState();
  const { settings, views, usingExample } = await buildViews(state);
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const kind = storageKind();
  const conn = state.connections;
  const live = views.filter((v) => !v.sample).length;
  const ch = channelReady(settings, conn);
  const host = process.env.VERCEL ? "vercel" : process.env.NETLIFY ? "netlify" : "local";
  const repo = process.env.VERCEL_GIT_REPO_OWNER && process.env.VERCEL_GIT_REPO_SLUG ? `https://github.com/${process.env.VERCEL_GIT_REPO_OWNER}/${process.env.VERCEL_GIT_REPO_SLUG}/edit/${process.env.VERCEL_GIT_COMMIT_REF || "main"}/vercel.json` : null;
  const cron = utcCronFor(settings);
  const masked = (n: string) => maskedValue(n, conn);
  const steps = [
    { done: kind !== "none", label: "Storage connected" },
    { done: !usingExample, label: "Your settings saved" },
    { done: live === views.length, label: `Your tools connected (${live} of ${views.length} KPIs live)` },
    { done: ch.ready, label: `Report channel ready (${CHANNEL_HELP[settings.channel].name})` },
    { done: !!state.lastReport?.ok, label: "Test report received" },
    { done: !!askReady(state), label: "Questions on your dashboard (or use the connector link below)" },
  ];

  return (
    <Shell title={settings.name} accent={settings.accent} active="setup">
      <section className="card">
        <h2 className="font-semibold">Your progress</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {steps.map((s) => (
            <li key={s.label} className="flex items-center gap-2 text-sm">
              <span className={`flex size-5 items-center justify-center rounded-full text-[11px] font-bold ${s.done ? "bg-emerald-600 text-white" : "border border-neutral-300 text-neutral-400"}`}>{s.done ? "✓" : ""}</span>
              {s.label}
            </li>
          ))}
        </ul>
      </section>

      {kind === "none" && (
        <Section id="storage" title="1. Connect storage">
          <p className="text-sm text-neutral-700">Your app needs a place to keep your numbers. In Vercel, open this project, then Storage, then Create Database, choose Blob, keep it Private and connect it to this project. Then redeploy.</p>
        </Section>
      )}

      <Section id="settings" title="Your settings">
        <p className="mb-3 text-sm text-neutral-700">Paste the settings block your AI gave you and press Save. You can edit it here any time.</p>
        <SaveSettings current={JSON.stringify(state.settings ?? exampleSettings, null, 2)} />
      </Section>

      <Section id="tools" title="Connect your tools">
        <p className="mb-4 text-sm text-neutral-700">
          Your analyst reads each KPI straight from its tool every time it builds your dashboard or report. Paste one read-only key per tool below. {live} of {views.length} KPIs are live; the rest show sample values.
        </p>
        <div className="flex flex-col gap-4">
          {neededKeys(settings.kpis).map((n) => <SaveConnection key={n.name} name={n.name} label={n.label} help={n.help} saved={masked(n.name)} />)}
        </div>
        {views.filter((v) => v.error).map((v) => <p key={v.id} className="mt-3 text-sm text-red-700">{v.name}: {v.error}</p>)}
        <div className="mt-5 rounded-xl bg-neutral-50 p-4">
          <h3 className="text-sm font-semibold">Tool not listed? Use your drop-off address</h3>
          <p className="mb-3 mt-1 text-xs text-neutral-600">
            Anything that can post to a web address can keep a KPI updated: a Make scenario (HTTP module, &ldquo;Make a request&rdquo;), a Zap with Webhooks by Zapier, n8n, or your AI on a schedule. Set that KPI&rsquo;s source to <code>{`{"type":"pushed"}`}</code> in your settings, then have it POST this every day:
          </p>
          <CopyField label="Your drop-off address (keep it private)" value={`${origin}/api/ingest/${ingestToken()}`} />
          <pre className="mt-3 overflow-x-auto rounded-lg bg-white p-3 font-mono text-xs">{`{ "kpi": "${settings.kpis[0]?.name ?? "Revenue"}", "date": "2026-10-16", "value": 12480 }`}</pre>
          <p className="mt-3 text-xs text-neutral-600">
            Your AI can also connect a new tool directly (AI-GUIDE.md in your repo). Typing values on <Link className="link" href="/numbers">Add numbers</Link> is the last resort.
          </p>
        </div>
      </Section>

      <Section id="report" title={`Your report (${CHANNEL_HELP[settings.channel].name})`}>
        <p className="mb-4 text-sm text-neutral-700">
          Goes only to you{settings.channel === "email" ? <> at <b>{settings.reportEmail ?? "the email in your settings"}</b></> : null}. Change the channel in your settings.
        </p>
        <div className="flex flex-col gap-4">
          {settings.channel === "slack" && (
            <div className="rounded-xl bg-neutral-50 p-3 text-sm">
              <p className="mb-2">Create your Slack bot in one paste: at api.slack.com/apps press Create New App, choose From a manifest, pick your workspace, paste this, and press Create.</p>
              <CopyField label="Slack app manifest" value={slackManifest(origin)} />
            </div>
          )}
          {CHANNEL_HELP[settings.channel].fields.map((f) => <SaveConnection key={f.name} {...f} saved={masked(f.name)} />)}
          {settings.channel === "telegram" && secret("TELEGRAM_BOT_TOKEN", conn) && (
            <div className="rounded-xl bg-neutral-50 p-3 text-sm">
              {secret("TELEGRAM_CHAT_ID", conn) ? <p>Telegram is connected to your chat.</p> : <><p className="mb-2">Press Connect, then open your bot in Telegram and send it any message.</p><ActionButton url="/api/telegram/connect" label="Connect Telegram" busyLabel="Connecting…" okText="Now send your bot a message in Telegram." /></>}
            </div>
          )}
          {ch.ready ? <ActionButton url="/api/report" label="Send test report" busyLabel="Sending…" okText="Sent. Check that it arrived." /> : <p className="text-sm text-amber-800">Still needed: {ch.missing.join(", ")}.</p>}
          {state.lastReport && <p className={`text-xs ${state.lastReport.ok ? "text-neutral-500" : "text-red-700"}`}>Last report {timeAgo(state.lastReport.at)}: {state.lastReport.detail}</p>}
        </div>
      </Section>

      <Section id="schedule" title="When it arrives">
        <p className="text-sm text-neutral-700">
          Your settings say {settings.reportDays === "weekdays" ? "weekdays" : settings.reportDays === "mondays" ? "Mondays" : "every day"} at {settings.reportHour}:00 ({settings.timezone}).
        </p>
        {host === "vercel" && (
          <div className="mt-3 text-sm text-neutral-700">
            <p>On Vercel&rsquo;s free plan the report runs once a day at the time set in <code>vercel.json</code>, and it can arrive up to an hour after that time. To match your settings, the line should be:</p>
            <pre className="mt-2 rounded-lg bg-neutral-50 p-3 font-mono text-xs">{`"schedule": "${cron}"`}</pre>
            {repo && <p className="mt-2"><a className="link" href={repo} target="_blank" rel="noreferrer">Open vercel.json on GitHub</a>, replace the schedule line, and commit. Vercel redeploys on its own.</p>}
          </div>
        )}
        {host === "netlify" && <p className="mt-3 text-sm text-neutral-700">On Netlify your analyst checks every hour and sends at your chosen hour. Nothing to change.</p>}
        {host === "local" && <p className="mt-3 text-sm text-neutral-700">Schedules run once your analyst is deployed.</p>}
      </Section>

      <Section id="questions" title="Ask your analyst questions">
        <div className="flex flex-col gap-5">
          <div>
            <h3 className="text-sm font-semibold">Inside Claude or ChatGPT (no extra cost on paid plans)</h3>
            <p className="mb-2 mt-1 text-xs text-neutral-600">Add this link as a custom connector in your Claude or ChatGPT settings (Connectors). Your plan has to allow custom connectors. Keep the link private: anyone with it can read your numbers.</p>
            <CopyField label="Your connector link" value={`${origin}/api/mcp/${mcpToken()}`} />
          </div>
          <div>
            <h3 className="text-sm font-semibold">In Slack, on your dashboard and in Telegram</h3>
            <p className="mb-2 mt-1 text-xs text-neutral-600">Needs one API key, billed by use (usually a few cents a day). This is separate from a Claude or ChatGPT subscription. In Slack, @mention AI Analyst in a channel it is in, or message it directly, and it answers in the thread.</p>
            <div className="flex flex-col gap-3">
              <SaveConnection name="ANTHROPIC_API_KEY" label="Anthropic API key" help="console.anthropic.com, API Keys, Create Key." saved={masked("ANTHROPIC_API_KEY")} />
              <SaveConnection name="OPENAI_API_KEY" label="or OpenAI API key" help="platform.openai.com, API keys, Create new secret key." saved={masked("OPENAI_API_KEY")} />
            </div>
          </div>
        </div>
      </Section>

      <Section id="share" title="Share your dashboard">
        <p className="mb-3 text-sm text-neutral-700">Make up a view-only passcode and send it with your dashboard link to your team or your boss. They see the dashboard and nothing else. Change it here any time to cut off access.</p>
        <SaveConnection name="VIEWER_PASSCODE" label="View-only passcode (10+ characters)" saved={masked("VIEWER_PASSCODE")} placeholder="Make one up" />
      </Section>

      <Section id="update" title="Keeping your analyst up to date">
        <p className="text-sm text-neutral-700">
          Your settings, numbers and keys live in your app&rsquo;s storage, not in the code, so updates never touch them. When How to AI improves the starter, paste the AI 301 recipe into Claude or ChatGPT and say &ldquo;Update my analyst&rdquo;.
        </p>
      </Section>

      <div className="mt-6 flex justify-end"><SignOut /></div>
    </Shell>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="card mt-5 scroll-mt-4">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function slackManifest(origin: string) {
  return JSON.stringify({
    display_information: { name: "AI Analyst", description: "Your KPIs every morning, and answers when you ask." },
    features: { bot_user: { display_name: "AI Analyst", always_online: true }, app_home: { messages_tab_enabled: true, messages_tab_read_only_enabled: false } },
    oauth_config: { scopes: { bot: ["app_mentions:read", "chat:write", "im:history"] } },
    settings: { event_subscriptions: { request_url: `${origin}/api/slack/events`, bot_events: ["app_mention", "message.im"] }, org_deploy_enabled: false, socket_mode_enabled: false, token_rotation_enabled: false },
  });
}

function maskedValue(name: string, conn: Connections) {
  const v = secret(name, conn);
  return v ? `••••${v.slice(-4)}` : null;
}

