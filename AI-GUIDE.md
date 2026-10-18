# Guide for the AI assistant helping a member

The member is probably not a coder. Keep messages to one or two sentences, do the work yourself when you can, and never ask them to paste a key or password into the chat. The passcode must be 10 characters or more; five wrong tries lock sign-in for 15 minutes. Setting `PUBLIC_DASHBOARD=1` lets anyone view the dashboard page only (for Public-safe KPIs); Add numbers, Setup, questions and every change still need the passcode. Keys go on the app's Setup page or in the host's environment variables.

## The settings block

The member pastes this on the Setup page. Generate it from the AI 301 interview. Only `kpis` is required.

```json
{
  "name": "Acme KPIs",
  "comparison": "last_week",
  "timezone": "America/New_York",
  "reportHour": 8,
  "reportDays": "weekdays",
  "channel": "email",
  "reportEmail": "me@example.com",
  "sensitivity": "private",
  "accent": "#ff6719",
  "kpis": [
    { "id": "revenue", "name": "Revenue", "format": "currency", "currency": "USD", "goodWhen": "up",
      "target": 50000, "targetPeriod": "month", "aggregate": "sum",
      "source": { "type": "stripe", "metric": "revenue" } },
    { "id": "signups", "name": "Signups", "format": "number", "target": 1200, "targetPeriod": "month", "aggregate": "sum",
      "source": { "type": "posthog", "project": "12345", "event": "user_signed_up" } },
    { "id": "churn", "name": "Churn", "format": "percent", "goodWhen": "down", "target": 2, "targetPeriod": "month", "aggregate": "latest",
      "source": { "type": "csv_url", "url": "https://docs.google.com/...output=csv", "dateColumn": "Date", "valueColumn": "Churn" } }
  ]
}
```

- `comparison`: `yesterday`, `last_week`, `last_month` or `target`.
- `target` and `targetPeriod` (`week`, `month`, `quarter`, `year`): the goal the KPI is pacing to. The dashboard and report say Ahead, On pace or Behind, and where the KPI is heading by the end of the period.
- `aggregate`: `sum` when daily values add up to the period total (revenue, signups, orders); `latest` when the newest value is the number (churn %, cash, pipeline, subscribers). If left out, the app guesses from the name.
- `reportDays`: `weekdays`, `daily` or `mondays`. `reportHour` is 0 to 23 in `timezone`.
- `channel`: `email`, `slack`, `teams`, `google_chat` or `telegram`. Email needs `reportEmail`.
- `format`: `number`, `currency` or `percent`. Use `goodWhen: "down"` for churn, costs and wait times.

## Sources (where each KPI's values come from)

Connected sources refresh on their own every time the dashboard, report or bot runs. Typing is a last resort.

| type | Metrics | Key saved on Setup | Extra fields |
| --- | --- | --- | --- |
| `stripe` | `revenue`, `new_customers`, `refunds` | `STRIPE_API_KEY` (restricted, read Charges and Customers) | |
| `shopify` | `sales`, `orders` | `SHOPIFY_ADMIN_TOKEN` (custom app, read_orders) | `store`: `mystore.myshopify.com` |
| `hubspot` | `won_amount`, `deals_won`, `new_deals`, `open_pipeline` | `HUBSPOT_TOKEN` (private app, crm.objects.deals.read) | |
| `posthog` | `count`, `unique_users` of one event | `POSTHOG_API_KEY` (personal, query read) | `project`, `event`, optional `host` |
| `csv_url` | one column of a published CSV | none | `url`, `dateColumn`, `valueColumn` |
| `pushed` | values posted to the drop-off address | none | |
| `manual` | typed or uploaded (last resort) | none | |

For any other tool, pick one:

1. **Drop-off address (no code).** Set the KPI's source to `{ "type": "pushed" }`. The Setup page shows a private address. Have a Make scenario (HTTP module, Make a request), a Zap (Webhooks by Zapier), n8n, or a scheduled AI task POST `{ "kpi": "Website visitors", "date": "2026-10-16", "value": 4212 }` to it every day, reading the value from the tool with the member's own login. Batches: `{ "values": [ ... ] }`.
2. **A new source file** (Claude Code or Codex), below.
3. **A published spreadsheet** the tool exports into on a schedule, with `csv_url`.

## Slack bot

The Setup page gives a one-paste Slack app manifest. The member creates the app from it, installs it, and saves `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET` and `SLACK_CHANNEL_ID` on Setup, then types `/invite @AI Analyst` in that channel. The morning report posts there, and anyone in the channel can @mention the bot (or message it directly) to ask about the KPIs; it answers in the thread. Answers need an Anthropic or OpenAI key. Set `SLACK_ALLOWED_USERS` to a comma-separated list of Slack user IDs to limit who gets answers.

## Changing the report time on Vercel

The free plan runs one daily job. Replace the `schedule` in `vercel.json` with the line shown on the Setup page (it converts the member's local hour to UTC) and commit. On Netlify, nothing to change: it checks hourly.

## "Update my analyst"

Settings, numbers and keys live in storage, so code updates are safe. Compare the member's repo with https://github.com/how-to-ai-co/ai-analyst-starter, copy over changed files, keep any custom files in `src/lib/sources/` and their registrations, keep their `vercel.json` schedule, commit, and let the host redeploy.

## Where things are

- `src/app/page.tsx` dashboard, `src/app/numbers` number entry, `src/app/setup` checklist
- `src/lib/metrics.ts` the numbers behind everything
- `src/lib/report.ts` and `src/lib/deliver.ts` the report and its channels
- `src/lib/ask.ts` the question tools; `src/app/api/mcp/[token]` the Claude or ChatGPT connector
- `src/app/api/cron/report` the schedule endpoint (sends at most once per local day)
