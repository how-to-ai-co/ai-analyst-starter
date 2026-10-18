"use client";
import { useState } from "react";
import { call } from "./api";

export function SaveSettings({ current }: { current: string }) {
  const [text, setText] = useState(current);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  return (
    <div className="flex flex-col gap-2">
      <textarea className="input h-56 font-mono text-xs" value={text} onChange={(e) => setText(e.target.value)} aria-label="Your settings" spellCheck={false} />
      <div className="flex items-center gap-3">
        <button className="btn-primary" onClick={async () => {
          try { await call("/api/settings", "POST", { text }); setMsg({ ok: true, t: "Saved. Your dashboard now uses these settings." }); setTimeout(() => location.reload(), 800); }
          catch (e) { setMsg({ ok: false, t: (e as Error).message }); }
        }}>Save settings</button>
        {msg && <span className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>{msg.t}</span>}
      </div>
    </div>
  );
}

export function SaveConnection({ name, label, help, saved, placeholder }: { name: string; label: string; help?: string; saved?: string | null; placeholder?: string }) {
  const [value, setValue] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  return (
    <form className="flex flex-col gap-1.5" onSubmit={async (e) => {
      e.preventDefault();
      try { await call("/api/connections", "POST", { name, value }); setMsg({ ok: true, t: "Saved" }); setTimeout(() => location.reload(), 600); }
      catch (err) { setMsg({ ok: false, t: (err as Error).message }); }
    }}>
      <label className="text-sm font-medium" htmlFor={name}>{label} {saved && <span className="badge ml-1 bg-emerald-100 text-emerald-800">Saved {saved}</span>}</label>
      {help && <p className="text-xs text-neutral-600">{help}</p>}
      <div className="flex gap-2">
        <input id={name} className="input" type="password" autoComplete="off" value={value} onChange={(e) => setValue(e.target.value)} placeholder={saved ? "Paste a new one to replace it" : placeholder ?? "Paste it here"} />
        <button className="btn-secondary" disabled={!value.trim()}>Save</button>
      </div>
      {msg && <span className={`text-xs ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>{msg.t}</span>}
    </form>
  );
}

export function ActionButton({ url, label, busyLabel, okText }: { url: string; label: string; busyLabel: string; okText: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button className="btn-primary" disabled={busy} onClick={async () => {
        setBusy(true); setMsg(null);
        try { await call(url, "POST"); setMsg({ ok: true, t: okText }); }
        catch (e) { setMsg({ ok: false, t: (e as Error).message }); }
        finally { setBusy(false); }
      }}>{busy ? busyLabel : label}</button>
      {msg && <span className={`text-sm ${msg.ok ? "text-emerald-700" : "text-red-700"}`}>{msg.t}</span>}
    </div>
  );
}

export function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex gap-2">
        <input className="input font-mono text-xs" readOnly value={value} onFocus={(e) => e.currentTarget.select()} aria-label={label} />
        <button className="btn-secondary" type="button" onClick={async () => { try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* select fallback */ } }}>{copied ? "Copied" : "Copy"}</button>
      </div>
    </div>
  );
}

export function SignOut() {
  return <button className="btn-secondary" onClick={async () => { await call("/api/logout", "POST"); location.href = "/"; }}>Sign out</button>;
}
