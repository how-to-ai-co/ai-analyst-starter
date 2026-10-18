import { isSignedIn, passcode } from "@/lib/auth";
import { LoginForm } from "./login-form";

/** Shows the passcode screen (or the "set a passcode" screen) instead of the page when needed. */
export async function Gate({ children }: { children: React.ReactNode }) {
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
        <p className="mt-2 text-neutral-600">Private dashboard. Enter your passcode to see your numbers.</p>
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
