import "server-only";
import { isSignedIn } from "./auth";

export const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

/** Runs the handler only for the signed-in owner. */
export async function owner(fn: () => Promise<Response>): Promise<Response> {
  if (!(await isSignedIn())) return json({ error: "Sign in with your passcode first." }, 401);
  try {
    return await fn();
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
}
