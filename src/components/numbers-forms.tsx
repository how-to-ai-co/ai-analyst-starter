"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { call } from "./api";

type Row = { id: string; name: string; format: string; points: number; lastDate: string | null; sourceType: string; url?: string };

export function NumbersForms({ kpis, canLink }: { kpis: Row[]; canLink: boolean }) {
  const router = useRouter();
  const today = new Date().toLocaleDateString("en-CA"); // local YYYY-MM-DD
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [csv, setCsv] = useState("");
  const [uploadKpi, setUploadKpi] = useState("");
  const done = (ok: boolean, text: string) => { setMsg({ ok, text }); if (ok) router.refresh(); };

  return (
    <div className="flex flex-col gap-6">
      {msg && <p className={`rounded-xl px-4 py-3 text-sm ${msg.ok ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-800"}`}>{msg.text}</p>}

      <section className="card">
        <h2 className="font-semibold">Type a number</h2>
        <p className="mt-1 text-sm text-neutral-600">Only for KPIs that live in no tool. Connected KPIs update themselves, so you never need this for them.</p>
        <div className="mt-4 flex flex-col gap-3">
          {kpis.map((k) => <QuickRow key={k.id} k={k} today={today} onDone={done} />)}
        </div>
      </section>

      <section className="card">
        <h2 className="font-semibold">Upload a spreadsheet</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Export a CSV from Excel, Google Sheets or any tool, then choose the file or paste it below. Use a date column plus one column per KPI named like the cards, or pick one KPI and upload a date column and a value column.
        </p>
        <div className="mt-4 flex flex-col gap-3">
          <select className="input" value={uploadKpi} onChange={(e) => setUploadKpi(e.target.value)} aria-label="Which KPI">
            <option value="">Columns are named after my KPIs</option>
            {kpis.map((k) => <option key={k.id} value={k.id}>Only {k.name} (date, value)</option>)}
          </select>
          <input type="file" accept=".csv,.tsv,.txt,text/csv" className="text-sm" aria-label="Choose a CSV file"
            onChange={async (e) => { const f = e.target.files?.[0]; if (f) setCsv(await f.text()); }} />
          <textarea className="input h-32 font-mono text-xs" value={csv} onChange={(e) => setCsv(e.target.value)} placeholder={"date,Revenue,New customers\n2026-10-16,12480,41"} aria-label="CSV text" />
          <button className="btn-primary self-start" disabled={!csv.trim()}
            onClick={async () => {
              try {
                const r = await call<{ added: number; skipped: number }>("/api/numbers", "POST", { csv, kpiId: uploadKpi || undefined });
                done(true, `Added ${r.added} numbers${r.skipped ? `, skipped ${r.skipped} rows without a date and a number` : ""}.`);
              } catch (err) { done(false, (err as Error).message); }
            }}>Upload numbers</button>
        </div>
      </section>

      {canLink && (
        <section className="card">
          <h2 className="font-semibold">Keep a KPI updated from a spreadsheet link</h2>
          <p className="mt-1 text-sm text-neutral-600">
            In Google Sheets: File, Share, Publish to web, pick the tab and CSV, then copy the link. Anyone with that link can see that tab, so use it only for numbers you are comfortable with. Leave the link empty to go back to typing numbers in.
          </p>
          <div className="mt-4 flex flex-col gap-4">
            {kpis.map((k) => <LinkRow key={k.id} k={k} onDone={done} />)}
          </div>
        </section>
      )}
    </div>
  );
}

function QuickRow({ k, today, onDone }: { k: Row; today: string; onDone: (ok: boolean, t: string) => void }) {
  const [value, setValue] = useState("");
  const [date, setDate] = useState(today);
  return (
    <form className="grid grid-cols-[1fr] gap-2 sm:grid-cols-[180px_1fr_150px_auto] sm:items-center"
      onSubmit={async (e) => {
        e.preventDefault();
        try { await call("/api/numbers", "POST", { kpiId: k.id, date, value }); onDone(true, `Saved ${k.name}.`); }
        catch (err) { onDone(false, (err as Error).message); }
      }}>
      <label className="text-sm font-medium" htmlFor={`v-${k.id}`}>
        {k.name}
        <span className="block text-xs font-normal text-neutral-500">{k.points ? `${k.points} numbers, last ${k.lastDate}` : "Sample numbers for now"}</span>
      </label>
      <input id={`v-${k.id}`} className="input" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} placeholder={k.format === "percent" ? "e.g. 3.5" : k.format === "currency" ? "e.g. 12480" : "e.g. 41"} />
      <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} aria-label={`Date for ${k.name}`} />
      <button className="btn-secondary" disabled={!value.trim()}>Save</button>
    </form>
  );
}

function LinkRow({ k, onDone }: { k: Row; onDone: (ok: boolean, t: string) => void }) {
  const [url, setUrl] = useState(k.url ?? "");
  return (
    <form className="flex flex-col gap-2 sm:flex-row sm:items-center"
      onSubmit={async (e) => {
        e.preventDefault();
        try { await call("/api/kpi-source", "POST", { kpiId: k.id, url }); onDone(true, url ? `${k.name} now reads from the link.` : `${k.name} is back to typed numbers.`); }
        catch (err) { onDone(false, (err as Error).message); }
      }}>
      <span className="text-sm font-medium sm:w-44">{k.name}</span>
      <input className="input flex-1" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://docs.google.com/…/pub?output=csv" aria-label={`Spreadsheet link for ${k.name}`} />
      <button className="btn-secondary">Save link</button>
    </form>
  );
}
