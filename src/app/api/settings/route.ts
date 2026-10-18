import { json, owner } from "@/lib/http";
import { parseSettings } from "@/lib/settings";
import { updateState } from "@/lib/store";

export async function POST(req: Request) {
  return owner(async () => {
    const { text } = await req.json();
    const parsed = parseSettings(text);
    if (!parsed.ok) return json({ error: parsed.error }, 400);
    await updateState((s) => { s.settings = parsed.settings; });
    return json({ ok: true, settings: parsed.settings });
  });
}
