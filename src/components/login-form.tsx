"use client";
import { useState } from "react";
import { call } from "./api";

export function LoginForm() {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="mt-6 flex flex-col gap-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          await call("/api/login", "POST", { passcode: value });
          location.reload();
        } catch (err) {
          setError((err as Error).message);
          setBusy(false);
        }
      }}
    >
      <label className="text-sm font-medium" htmlFor="pc">Passcode</label>
      <input id="pc" type="password" autoComplete="current-password" value={value} onChange={(e) => setValue(e.target.value)} className="input" placeholder="The passcode you chose when you deployed" />
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button className="btn-primary" disabled={busy || value.length < 1}>{busy ? "Checking…" : "Open my dashboard"}</button>
    </form>
  );
}
