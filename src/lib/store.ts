import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { State } from "./types";

/**
 * One small JSON document holds everything: settings, numbers and saved connections.
 * Storage is picked automatically:
 *   Vercel  -> a private Vercel Blob store (created by the Deploy button)
 *   Netlify -> Netlify Blobs (built in, nothing to set up)
 *   locally -> .data/state.json
 */
const KEY = "analyst/state.json";

export const emptyState = (): State => ({ version: 1, settings: null, data: {}, updated: {}, connections: {} });

export function storageKind(): "vercel" | "netlify" | "local" | "none" {
  if (process.env.BLOB_READ_WRITE_TOKEN) return "vercel";
  if (process.env.NETLIFY || process.env.NETLIFY_BLOBS_CONTEXT) return "netlify";
  if (process.env.VERCEL) return "none"; // deployed on Vercel without a Blob store yet
  return "local";
}

export async function loadState(): Promise<State> {
  const kind = storageKind();
  try {
    if (kind === "vercel") {
      const { get } = await import("@vercel/blob");
      const res = await get(KEY, { access: "private", useCache: false });
      if (!res || res.statusCode !== 200) return emptyState();
      const text = await new Response(res.stream).text();
      return { ...emptyState(), ...JSON.parse(text) };
    }
    if (kind === "netlify") {
      const { getStore } = await import("@netlify/blobs");
      const data = await getStore("analyst").get("state", { type: "json" });
      return data ? { ...emptyState(), ...data } : emptyState();
    }
    if (kind === "local") {
      const file = path.join(process.cwd(), ".data", "state.json");
      const text = await fs.readFile(file, "utf8").catch(() => "");
      return text ? { ...emptyState(), ...JSON.parse(text) } : emptyState();
    }
  } catch (err) {
    if (isNotFound(err)) return emptyState();
    throw err;
  }
  return emptyState();
}

export async function saveState(state: State): Promise<void> {
  const kind = storageKind();
  const body = JSON.stringify(state);
  if (kind === "vercel") {
    const { put } = await import("@vercel/blob");
    await put(KEY, body, {
      access: "private",
      allowOverwrite: true,
      addRandomSuffix: false,
      contentType: "application/json",
      cacheControlMaxAge: 60,
    });
    return;
  }
  if (kind === "netlify") {
    const { getStore } = await import("@netlify/blobs");
    await getStore("analyst").set("state", body);
    return;
  }
  if (kind === "local") {
    const dir = path.join(process.cwd(), ".data");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, "state.json"), body);
    return;
  }
  throw new Error("No storage connected yet. On Vercel, open your project, then Storage, and connect a Blob store.");
}

export async function updateState(fn: (s: State) => State | void): Promise<State> {
  const current = await loadState();
  const next = fn(current) ?? current;
  await saveState(next);
  return next;
}

function isNotFound(err: unknown) {
  const msg = String((err as Error)?.message ?? err);
  return /not.?found|404/i.test(msg);
}
