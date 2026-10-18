import { isSignedIn, isViewer, passcode, publicDashboard } from "@/lib/auth";
import { secret } from "@/lib/deliver";
import { loadState } from "@/lib/store";
import { LoginForm } from "./login-form";

/** Shows the passcode screen (or the "set a passcode" screen) instead of the page when needed. */
export async function Gate({ children, allowPublic = false }: { children: React.ReactNode; allowPublic?: boolean }) {
  if (allowPublic && publicDashboard()) return <>{children}</>;
  if (allowPublic && passcode() && !(await isSignedIn())) {
    const v = secret("VIEWER_PASSCODE", (await loadState()).connections);
    if (await isViewer(v)) return <>{children}</>;
  }
  if (!passcode()) {
    return (
      <Center>
        <h1 className="text-2xl font-bold">Almost there</h1>
        <p className="mt-3 text-neutral-700">
          Your analyst needs a passcode before it can show your numbers. In your host&rsquo;s project settings, add an environment variable named <code className="rounded bg-neutral-100 px-1">DASHBOARD_PASSCODE</code> with a passcode of 10 characters or more, then redeploy. If you set a shorter one, make it longer.
        </p>
      </Center>
    );
  }
  if (!(await isSignedIn())) {
    return (
      <Center>
        <h1 className="text-2xl font-bold">Your AI analyst</h1>
        <p className="mt-2 text-neutral-600">{allowPublic ? "Private dashboard. Enter your passcode to see the numbers." : "This page needs the owner's passcode. A view-only passcode opens the dashboard only."}</p>
        <LoginForm />
      </Center>
    );
  }
  return <>{children}</>;
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5">
      <div className="card">{children}</div>
    </main>
  );
}
