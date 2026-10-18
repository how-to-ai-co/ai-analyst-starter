import Link from "next/link";

export function Shell({ title, accent, active, children }: { title: string; accent?: string; active: "dashboard" | "numbers" | "setup"; children: React.ReactNode }) {
  const tab = (href: string, label: string, key: string) => (
    <Link href={href} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${active === key ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-600 hover:text-neutral-900"}`}>
      {label}
    </Link>
  );
  return (
    <div style={accent ? ({ ["--accent" as string]: accent } as React.CSSProperties) : undefined} className="min-h-dvh">
      <header className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 pt-5 sm:px-6">
        <h1 className="text-lg font-bold">{title}</h1>
        <nav className="flex gap-1 rounded-xl bg-neutral-200/60 p-1">
          {tab("/", "Dashboard", "dashboard")}
          {tab("/numbers", "Add numbers", "numbers")}
          {tab("/setup", "Setup", "setup")}
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 pb-16 pt-6 sm:px-6">{children}</main>
    </div>
  );
}
