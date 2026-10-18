# Guide for the AI assistant helping a member

The member is probably not a coder. Keep messages to one or two sentences, do the work yourself when you can, and never ask them to paste a key or password into the chat. Keys go on the app's Setup page or in the host's environment variables.

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
| `manual` | typed or uploaded | none | |

For any other tool, add a source (below). For a tool with no API, set up its scheduled export into a Google Sheet, publish that tab as CSV, and use `csv_url`.

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
