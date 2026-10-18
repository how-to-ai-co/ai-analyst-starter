import { json, owner } from "@/lib/http";
import { buildViews } from "@/lib/metrics";
import { loadState } from "@/lib/store";

export async function GET() {
  return owner(async () => {
    const { settings, views, usingExample } = await buildViews(await loadState());
    return json({ name: settings.name, comparison: settings.comparison, usingExample, views });
  });
}
