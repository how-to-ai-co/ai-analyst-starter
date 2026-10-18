import { Gate } from "@/components/gate";
import { NumbersForms } from "@/components/numbers-forms";
import { Shell } from "@/components/shell";
import { exampleSettings } from "@/lib/sample";
import { loadState } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function NumbersPage() {
  return (
    <Gate>
      <Body />
    </Gate>
  );
}

async function Body() {
  const state = await loadState();
  const settings = state.settings ?? exampleSettings;
  const kpis = settings.kpis.map((k) => {
    const pts = state.data[k.id] ?? [];
    return { id: k.id, name: k.name, format: k.format, points: pts.length, lastDate: pts[pts.length - 1]?.date ?? null, sourceType: k.source.type, url: (k.source as { url?: string }).url };
  });
  return (
    <Shell title={settings.name} accent={settings.accent} active="numbers">
      <NumbersForms kpis={kpis} canLink={!!state.settings} />
    </Shell>
  );
}
