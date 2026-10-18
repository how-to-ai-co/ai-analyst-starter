import type { Kpi, Point } from "./types";

/** Parse CSV text into rows of cells. Handles quotes, commas inside quotes and Windows line endings. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === "," || ch === "\t" || ch === ";") { row.push(cell.trim()); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell.trim()); cell = "";
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell.trim());
  if (row.some((c) => c !== "")) rows.push(row);
  return rows;
}

/** "$12,480.50" -> 12480.5, "3.2%" -> 3.2, "(120)" -> -120. Returns null when not a number. */
export function toNumber(raw: string | undefined): number | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;
  const negative = /^\(.*\)$/.test(s) || s.startsWith("-");
  s = s.replace(/[()\s$£€¥%,]|[A-Za-z]{3}$/g, "").replace(/^-/, "");
  if (!/^\d*\.?\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? (negative ? -n : n) : null;
}

/** Accepts 2026-10-17, 17/10/2026, 10/17/2026, Oct 17 2026 and similar. Returns YYYY-MM-DD or null. */
export function toDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})$/);
  if (m) {
    const a = +m[1], b = +m[2], y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
    // Day first when it cannot be a month, otherwise US month first.
    return a > 12 ? iso(y, b, a) : iso(y, a, b);
  }
  const t = Date.parse(s);
  if (!Number.isNaN(t)) { const d = new Date(t); return iso(d.getFullYear(), d.getMonth() + 1, d.getDate()); }
  return null;
}

function iso(y: number, mo: number, d: number) {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Turn an uploaded table into points per KPI. Understands three shapes:
 *   1. date, value                 (one KPI, chosen on the upload form)
 *   2. date, Revenue, Signups, ... (one column per KPI, matched by name or id)
 *   3. date, kpi, value            (one row per KPI per day)
 */
export function tableToPoints(rows: string[][], kpis: Kpi[], onlyKpi?: string): { points: Record<string, Point[]>; skipped: number; matched: string[] } {
  const points: Record<string, Point[]> = {};
  let skipped = 0;
  if (rows.length === 0) return { points, skipped, matched: [] };

  const header = rows[0];
  const hasHeader = toDate(header[0]) === null;
  const body = hasHeader ? rows.slice(1) : rows;
  const findKpi = (label: string) => kpis.find((k) => norm(k.id) === norm(label) || norm(k.name) === norm(label));
  const push = (id: string, date: string, value: number) => { (points[id] ??= []).push({ date, value }); };

  const dateCol = hasHeader ? Math.max(0, header.findIndex((h) => /date|day|week|month|period/i.test(h))) : 0;

  if (onlyKpi) {
    const valueCol = hasHeader ? header.findIndex((h, i) => i !== dateCol && h !== "") : 1;
    for (const r of body) {
      const d = toDate(r[dateCol]); const v = toNumber(r[valueCol === -1 ? 1 : valueCol]);
      if (d && v !== null) push(onlyKpi, d, v); else skipped++;
    }
    return { points, skipped, matched: Object.keys(points) };
  }

  if (hasHeader) {
    const kpiCol = header.findIndex((h) => /^(kpi|metric|name)$/i.test(h));
    const valCol = header.findIndex((h) => /^(value|amount|count|total)$/i.test(h));
    if (kpiCol !== -1 && valCol !== -1) {
      for (const r of body) {
        const k = findKpi(r[kpiCol] ?? ""); const d = toDate(r[dateCol]); const v = toNumber(r[valCol]);
        if (k && d && v !== null) push(k.id, d, v); else skipped++;
      }
      return { points, skipped, matched: Object.keys(points) };
    }
    const cols = header.map((h, i) => (i === dateCol ? null : findKpi(h)));
    for (const r of body) {
      const d = toDate(r[dateCol]);
      if (!d) { skipped++; continue; }
      cols.forEach((k, i) => { if (!k) return; const v = toNumber(r[i]); if (v !== null) push(k.id, d, v); });
    }
  }
  return { points, skipped, matched: Object.keys(points) };
}

/** Merge new points into existing ones; the newest value for a date wins. */
export function mergePoints(existing: Point[] = [], incoming: Point[]): Point[] {
  const byDate = new Map(existing.map((p) => [p.date, p.value]));
  for (const p of incoming) byDate.set(p.date, p.value);
  return [...byDate.entries()].map(([date, value]) => ({ date, value })).sort((a, b) => a.date.localeCompare(b.date)).slice(-400);
}
