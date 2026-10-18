import Link from "next/link";
import { AskBox } from "@/components/ask-box";
import { Gate } from "@/components/gate";
import { KpiCard } from "@/components/kpi-card";
import { Shell } from "@/components/shell";
import { askReady } from "@/lib/ask";
import { buildViews } from "@/lib/metrics";
import { loadState } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  return (
    <Gate>
      <DashboardBody />
    </Gate>
  );
}

async function DashboardBody() {
  const state = await loadState();
  const { settings, views, usingExample } = await buildViews(state);
  const samples = views.filter((v) => v.sample).length;
  const first = views[0]?.name ?? "revenue";
  return (
    <Shell title={settings.name} accent={settings.accent} active="dashboard">
      {usingExample ? (
        <Notice>
          These are example KPIs. Paste the settings your AI gave you on <Link className="link" href="/setup#settings">Setup</Link> and this becomes your dashboard.
        </Notice>
      ) : samples > 0 ? (
        <Notice>
          {samples === views.length ? "All" : samples} of your numbers {samples === 1 ? "is" : "are"} still sample values. <Link className="link" href="/numbers">Add your numbers</Link> to make them real.
        </Notice>
      ) : null}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {views.map((k) => (
          <KpiCard key={k.id} k={k} comparison={settings.comparison} />
        ))}
      </section>
      <section className="card mt-6">
        <h2 className="mb-3 font-semibold">Ask your analyst</h2>
        <AskBox ready={!!askReady(state)} examples={[`How did ${first.toLowerCase()} change this week?`, "What moved the most?", "Which number needs attention?"]} />
      </section>
    </Shell>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return <p className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{children}</p>;
}
