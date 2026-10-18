import { passcode, signIn } from "@/lib/auth";
import { json } from "@/lib/http";
import { loadState, updateState } from "@/lib/store";

const MAX_FAILS = 5;
const LOCK_MINUTES = 15;

export async function POST(req: Request) {
  if (!passcode()) return json({ error: "No passcode is set yet. Add DASHBOARD_PASSCODE (10 characters or more) in your host's environment variables, then redeploy." }, 400);
  const state = await loadState();
  const locked = state.security?.lockedUntil && Date.parse(state.security.lockedUntil) > Date.now();
  if (locked) return json({ error: `Too many wrong tries. Try again after ${new Date(state.security!.lockedUntil!).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}.` }, 429);

  const { passcode: attempt } = await req.json().catch(() => ({ passcode: "" }));
  await new Promise((r) => setTimeout(r, 400));
  if (await signIn(String(attempt ?? ""))) {
    if (state.security?.fails) await updateState((s) => { s.security = { fails: 0 }; });
    return json({ ok: true });
  }
  const fails = (state.security?.fails ?? 0) + 1;
  await updateState((s) => {
    s.security = fails >= MAX_FAILS ? { fails: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60000).toISOString() } : { fails };
  });
  return json({ error: fails >= MAX_FAILS ? `Too many wrong tries. Locked for ${LOCK_MINUTES} minutes.` : "That passcode didn't match." }, 401);
}
