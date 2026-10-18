# Your AI analyst

A private dashboard of your key numbers, a report sent to you on a schedule, and an analyst you can ask questions. Made for the How to AI AI 301 workshop.

## Start

Pick one. Both are free to start.

| Use it for | Button |
| --- | --- |
| Personal tracking, learning, side projects | [Deploy to Vercel](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fhow-to-ai-co%2Fai-analyst-starter&project-name=my-ai-analyst&repository-name=my-ai-analyst&env=DASHBOARD_PASSCODE&envDescription=Make+up+a+passcode+%286+characters+or+more%29.+You+will+type+it+to+open+your+dashboard.&stores=%5B%7B%22type%22%3A%22blob%22%2C%22access%22%3A%22private%22%7D%5D) |
| Your business or your employer's numbers | [Deploy to Netlify](https://app.netlify.com/start/deploy?repository=https://github.com/how-to-ai-co/ai-analyst-starter) |

Vercel's free plan is for personal, non-commercial use. For business numbers, use Netlify's free plan, or Vercel's paid plan.

When it asks, make up a passcode. Then open your new site, type the passcode, and follow the **Setup** page. It shows a checklist and tells you each next step.

## What you do, in order

1. **Settings.** Paste the settings block your AI gave you (from the AI 301 recipe) on the Setup page.
2. **Connect your tools.** Paste one read-only key per tool on Setup (Stripe, Shopify, HubSpot, PostHog built in; your AI can add others). Your KPIs then update themselves. Until then, cards show sample values.
3. **Report.** Save one key or link for your channel (email, Slack, Teams, Google Chat or Telegram) and press Send test report.
4. **Schedule.** On Netlify it is automatic. On Vercel, the Setup page gives you one line to paste into `vercel.json`.
5. **Questions.** Copy your connector link into Claude or ChatGPT, or save an Anthropic or OpenAI key to ask on the dashboard and in Telegram.

## What to expect

- Everything is private to you behind your passcode. Sharing is your choice.
- Keys you save on the Setup page are stored in your own app's private storage and never shown again.
- On Teams, your report arrives in Teams. Asking questions happens in Claude, ChatGPT or the dashboard, because a Teams bot that answers back needs your IT team.
- On Vercel's free plan the report can arrive up to an hour after the scheduled time.
- Connected KPIs update themselves. Anything typed in by hand shows "Needs update" after three days.
- Give each KPI a target and the dashboard and report show whether you are on pace.

For AI assistants helping with this app, read [AI-GUIDE.md](AI-GUIDE.md).
