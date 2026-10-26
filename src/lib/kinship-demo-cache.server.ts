// Private fallback for the three demo seeds (Radiohead, Nike, Drake).
// If the Qloo key dies or quota runs out, a local checkout can keep working from
// the last successful lookup. The file is gitignored and must never arm on
// Vercel: the platform filesystem is read-only outside /tmp, and a deployed
// copy of this file would show old scores as if they were live.
import { access, constants, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

export const DEMO_SEEDS = ["Radiohead", "Nike", "Drake"] as const;

const CACHE_REL = ".secrets/qloo-demo-cache.json";

let pathOverride: string | null = null;
let allowedMemo: boolean | null = null;

export function demoCacheDecision(input: { vercel: string | undefined; writable: boolean }): boolean {
  if (input.vercel) return false;
  return input.writable;
}

export function resetDemoCacheForTests(path: string | null = null): void {
  pathOverride = path;
  allowedMemo = null;
}

function cachePath(): string {
  return pathOverride ?? join(process.cwd(), CACHE_REL);
}

export async function demoCacheAllowed(): Promise<boolean> {
  if (allowedMemo !== null) return allowedMemo;
  if (!demoCacheDecision({ vercel: process.env.VERCEL, writable: true })) {
    allowedMemo = false;
    return false;
  }
  allowedMemo = await directoryWritable(dirname(cachePath()));
  return allowedMemo;
}

async function directoryWritable(dir: string): Promise<boolean> {
  const probe = join(dir, ".write-probe");
  try {
    await mkdir(dir, { recursive: true });
    await writeFile(probe, "ok");
    await unlink(probe);
    await access(dir, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

type StatusRecord = { status?: unknown };

// Every cached serve carries cached: true. Other statuses are not served.
export function labelCachedServe<T extends StatusRecord>(value: T): (T & { cached: true }) | null {
  if (!value || typeof value !== "object") return null;
  if (value.status !== "matched" && value.status !== "ambiguous") return null;
  return { ...value, cached: true };
}

export async function readDemoCache<T extends StatusRecord>(seed: string): Promise<(T & { cached: true }) | null> {
  if (!(DEMO_SEEDS as readonly string[]).includes(seed)) return null;
  if (!(await demoCacheAllowed())) return null;
  try {
    const text = await readFile(cachePath(), "utf8");
    const parsed = JSON.parse(text) as Record<string, T>;
    const saved = parsed[seed];
    if (!saved || typeof saved !== "object") return null;
    return labelCachedServe(saved);
  } catch {
    return null;
  }
}

export async function writeDemoCache(seed: string, value: unknown): Promise<void> {
  if (!(DEMO_SEEDS as readonly string[]).includes(seed)) return;
  if (!(await demoCacheAllowed())) return;
  try {
    const path = cachePath();
    await mkdir(dirname(path), { recursive: true });
    let current: Record<string, unknown> = {};
    try {
      current = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
    } catch {
      current = {};
    }
    if (value && typeof value === "object") {
      const stored = { ...(value as Record<string, unknown>) };
      delete stored.cached;
      current[seed] = stored;
    } else {
      current[seed] = value;
    }
    await writeFile(path, JSON.stringify(current, null, 2), "utf8");
  } catch {
    // Cache is best-effort. A write failure must never break a live lookup.
  }
}
