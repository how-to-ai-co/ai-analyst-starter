import "server-only";
import { computePace } from "./pace";
import { samplePoints, exampleSettings } from "./sample";
import { sourceLabel, sources } from "./sources";
import { updateState } from "./store";
import type { Kpi, KpiView, Point, Settings, State } from "./types";

const DAY = 86400000;
const CACHE_MS = 15 * 60 * 1000;

/** The numbers behind the dashboard, the report and every answer the bot gives. */
export async function buildViews(state: State): Promise<{ settings: Settings; views: KpiView[]; usingExample: boolean }> {
  const settings = state.settings ?? exampleSettings;
  const views = await Promise.all(settings.kpis.map((k) => buildView(k, settings, state)));
  if (state.cacheDirty) {
    delete state.cacheDirty;
    const fresh = state.cache;
    await updateState((s) => { s.cache = fresh; }).catch(() => undefined); // a failed cache save never breaks the page
  }
  return { settings, views, usingExample: !state.settings };
}

async function buildView(kpi: Kpi, settings: Settings, state: State): Promise<KpiView> {
  let series: Point[] = state.data[kpi.id] ?? [];
  let updatedAt = state.updated[kpi.id] ?? null;
  let error: string | undefined;

  const src = sources[kpi.source.type];
  if (src?.fetch) {
    const key = JSON.stringify(kpi.source) + settings.timezone;
    const cached = state.cache?.[kpi.id];
    try {
      if (cached && cached.key === key && Date.now() - Date.parse(cached.at) < CACHE_MS) {
        series = cached.series;
        updatedAt = cached.at;
      } else {
        series = await src.fetch(kpi, state.connections, settings.timezone);
        updatedAt = new Date().toISOString();
        (state.cache ??= {})[kpi.id] = { at: updatedAt, key, series };
        state.cacheDirty = true;
      }
    } catch (e) {
      error = (e as Error).message;
      series = state.data[kpi.id] ?? [];
    }
  } else if (!src && kpi.source.type !== "manual") {
    error = `Unknown source "${kpi.source.type}". Ask your AI to add it in src/lib/sources/.`;
  }

  const sample = series.length === 0;
  if (sample) series = samplePoints(kpi, 120);
  series = [...series].sort((a, b) => a.date.localeCompare(b.date));

  const last = series[series.length - 1];
  const value = last?.value ?? null;
  const previous = pickPrevious(series, settings.comparison, kpi);
  const change = value !== null && previous !== null ? value - previous : null;
  const changePct = change !== null && previous ? (change / Math.abs(previous)) * 100 : null;
  const trend = change === null ? null : Math.abs(change) < 1e-9 ? "flat" : change > 0 ? "up" : "down";
  const goodWhen = kpi.goodWhen ?? "up";
  const good = trend === null || trend === "flat" ? null : (trend === goodWhen);

  // Stale when the newest number is more than 3 days old, which matters most for typed-in numbers.
  const stale = !sample && !!last && Date.now() - Date.parse(last.date) > 3 * DAY;

  const today = new Intl.DateTimeFormat("en-CA", { timeZone: settings.timezone }).format(new Date());
  const pace = computePace(kpi, series, today);

  return {
    pace,
    id: kpi.id,
    name: kpi.name,
    format: kpi.format,
    currency: kpi.currency,
    value,
    previous,
    change,
    changePct,
    trend,
    good,
    series: series.slice(-30),
    sample,
    sourceLabel: sample ? "Sample numbers" : sourceLabel(kpi),
    updatedAt: sample ? null : updatedAt ?? last?.date ?? null,
    stale,
    error,
  };
}

function pickPrevious(series: Point[], comparison: Settings["comparison"], kpi: Kpi): number | null {
  if (comparison === "target") return typeof kpi.target === "number" ? kpi.target : null;
  if (series.length < 2) return null;
  const last = Date.parse(series[series.length - 1].date);
  const back = comparison === "yesterday" ? 1 : comparison === "last_week" ? 7 : 30;
  const want = last - back * DAY;
  let best: Point | null = null;
  for (const p of series.slice(0, -1)) if (Date.parse(p.date) <= want) best = p;
  return (best ?? series[series.length - 2]).value;
}

/** History for one KPI between two dates, used by the question tools. */
export async function history(state: State, kpiId: string, start?: string, end?: string) {
  const { views, settings } = await buildViews(state);
  const kpi = settings.kpis.find((k) => k.id === kpiId || k.name.toLowerCase() === kpiId.toLowerCase());
  if (!kpi) return null;
  let series = state.data[kpi.id] ?? [];
  const src = sources[kpi.source.type];
  if (src?.fetch) series = await src.fetch(kpi, state.connections, settings.timezone).catch(() => series);
  const sample = series.length === 0;
  if (sample) series = samplePoints(kpi, 120);
  const view = views.find((v) => v.id === kpi.id)!;
  return {
    kpi: kpi.name,
    format: kpi.format,
    sample,
    points: series.filter((p) => (!start || p.date >= start) && (!end || p.date <= end)),
    latest: view.value,
    comparedWith: view.previous,
  };
}
