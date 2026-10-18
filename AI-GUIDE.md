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
    { "id": "revenue", "name": "Revenue", "format": "currency", "currency": "USD", "goodWhen": "up", "source": { "type": "manual" } },
    { "id": "churn", "name": "Churn", "format": "percent", "goodWhen": "down", "source": { "type": "manual" } }
  ]
}
```

- `comparison`: `yesterday`, `last_week`, `last_month` or `target` (then give each KPI a `target`).
- `reportDays`: `weekdays`, `daily` or `mondays`. `reportHour` is 0 to 23 in `timezone`.
- `channel`: `email`, `slack`, `teams`, `google_chat` or `telegram`. Email needs `reportEmail`.
- `format`: `number`, `currency` or `percent`. Use `goodWhen: "down"` for churn, costs and wait times.
- `source`: `{ "type": "manual" }` (typed in or uploaded) or `{ "type": "csv_url", "url": "https://...", "dateColumn": "Date", "valueColumn": "Revenue" }`.

## Adding a tool as a source (Stripe, HubSpot, a database...)

1. Copy `src/lib/sources/csv-url.ts` to a new file, for example `stripe.ts`.
2. Fetch the history with the tool's narrowest read-only key, read from `connections` (for example `connections.STRIPE_API_KEY`) or `process.env`. Return `[{ date: "YYYY-MM-DD", value: number }]`.
3. Register it in `src/lib/sources/index.ts` and set the KPI's source to `{ "type": "stripe" }`.
4. The member saves the key on the Setup page (any name like `STRIPE_API_KEY` works) and the card switches from Sample to live.

Totals and counts only. Never pull names or personal details, especially for law, healthcare, finance, HR and education.

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
