// Netlify runs this every hour. The app decides whether it is your report hour and sends at most once a day.
export default async () => {
  const base = process.env.URL;
  if (!base) return;
  await fetch(`${base}/api/cron/report?mode=hourly`, {
    headers: process.env.CRON_SECRET ? { authorization: `Bearer ${process.env.CRON_SECRET}` } : { "x-analyst-scheduler": "netlify" },
  });
};

export const config = { schedule: "@hourly" };
