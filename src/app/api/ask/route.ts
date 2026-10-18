import { ask } from "@/lib/ask";
import { json, owner } from "@/lib/http";
import { loadState } from "@/lib/store";

export async function POST(req: Request) {
  return owner(async () => {
    const { question } = await req.json();
    if (!question || String(question).trim().length < 3) return json({ error: "Type a question first." }, 400);
    return json({ answer: await ask(await loadState(), String(question)) });
  });
}
