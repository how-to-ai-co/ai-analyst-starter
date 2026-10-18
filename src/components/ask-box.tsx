"use client";
import { useState } from "react";
import { call } from "./api";

export function AskBox({ ready, examples }: { ready: boolean; examples: string[] }) {
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  if (!ready) {
    return (
      <p className="text-sm text-neutral-600">
        Want to ask questions here? Add an Anthropic or OpenAI key on <a className="link" href="/setup#questions">Setup</a>, or connect your analyst to Claude or ChatGPT.
      </p>
    );
  }
  async function go(question: string) {
    setBusy(true); setError(""); setAnswer("");
    try { setAnswer((await call<{ answer: string }>("/api/ask", "POST", { question })).answer); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return (
    <div>
      <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); if (q.trim()) go(q); }}>
        <input className="input flex-1" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about your numbers" aria-label="Ask about your numbers" />
        <button className="btn-primary" disabled={busy || !q.trim()}>{busy ? "Thinking…" : "Ask"}</button>
      </form>
      <div className="mt-2 flex flex-wrap gap-2">
        {examples.map((ex) => (
          <button key={ex} type="button" className="chip" onClick={() => { setQ(ex); go(ex); }}>{ex}</button>
        ))}
      </div>
      {answer && <p className="mt-3 rounded-lg bg-neutral-50 p-3 text-[15px] leading-relaxed">{answer}</p>}
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
    </div>
  );
}
