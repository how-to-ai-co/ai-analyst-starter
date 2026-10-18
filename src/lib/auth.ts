import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * One passcode protects everything. It is set as DASHBOARD_PASSCODE when the app is deployed.
 * The session cookie holds a signature of the passcode, never the passcode itself,
 * so changing the passcode signs everyone out.
 */
const COOKIE = "analyst_session";

export function passcode(): string | null {
  const p = process.env.DASHBOARD_PASSCODE?.trim();
  return p && p.length >= 10 ? p : null;
}

export function sign(purpose: string): string {
  const p = passcode() ?? "not-set";
  return createHmac("sha256", p).update(purpose).digest("hex");
}

export async function isSignedIn(): Promise<boolean> {
  if (!passcode()) return false;
  const c = (await cookies()).get(COOKIE)?.value;
  return !!c && safeEqual(c, sign("session"));
}

const VIEWER = "analyst_viewer";
const COOKIE_OPTS = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 90 };

/**
 * Signs in as the owner (the DASHBOARD_PASSCODE) or as a viewer (the view-only passcode saved on Setup).
 * Viewers see the dashboard and nothing else: no Setup, no Add numbers, no questions, no changes.
 */
export async function signIn(attempt: string, viewerPasscode?: string): Promise<"owner" | "viewer" | null> {
  const p = passcode();
  const a = attempt.trim();
  if (!p) return null;
  if (safeEqual(a, p)) {
    (await cookies()).set(COOKIE, sign("session"), COOKIE_OPTS);
    return "owner";
  }
  if (viewerPasscode && viewerPasscode.length >= 10 && safeEqual(a, viewerPasscode)) {
    (await cookies()).set(VIEWER, sign(`viewer:${viewerPasscode}`), COOKIE_OPTS);
    return "viewer";
  }
  return null;
}

/** True for a viewer whose view-only passcode is still the current one. */
export async function isViewer(viewerPasscode?: string): Promise<boolean> {
  if (!passcode() || !viewerPasscode) return false;
  const c = (await cookies()).get(VIEWER)?.value;
  return !!c && safeEqual(c, sign(`viewer:${viewerPasscode}`));
}

export async function signOut() {
  const jar = await cookies();
  jar.delete(COOKIE);
  jar.delete(VIEWER);
}

/**
 * PUBLIC_DASHBOARD=1 lets anyone view the dashboard without the passcode (for public-safe
 * KPIs or a demo). Add numbers, Setup and every change still need the passcode.
 */
export const publicDashboard = () => process.env.PUBLIC_DASHBOARD === "1";

/** Secret in the drop-off address that Make, Zapier or Claude post KPI values to. */
export const ingestToken = () => sign("ingest").slice(0, 40);
/** Secret for the Claude or ChatGPT connector URL, derived from the passcode. */
export const mcpToken = () => sign("mcp").slice(0, 40);
/** Secret Telegram sends back with every message, derived from the passcode. */
export const telegramSecret = () => sign("telegram").slice(0, 48);

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
