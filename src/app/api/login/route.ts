import { passcode, signIn } from "@/lib/auth";
import { json } from "@/lib/http";

export async function POST(req: Request) {
  if (!passcode()) return json({ error: "No passcode is set yet. Add DASHBOARD_PASSCODE (6 characters or more) in your host's environment variables, then redeploy." }, 400);
  const { passcode: attempt } = await req.json().catch(() => ({ passcode: "" }));
  await new Promise((r) => setTimeout(r, 400)); // slows down guessing
  return (await signIn(String(attempt ?? ""))) ? json({ ok: true }) : json({ error: "That passcode didn't match." }, 401);
}
