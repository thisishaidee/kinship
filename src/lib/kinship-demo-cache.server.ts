// Private fallback for the three demo seeds (Radiohead, Nike, Drake).
// If the Qloo key dies or quota runs out, the demo keeps working from the last
// successful lookup. The cache lives in a gitignored .secrets/ file and is never
// committed: Qloo's developer terms forbid storing its response data in a public repo.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

export const DEMO_SEEDS = ["Radiohead", "Nike", "Drake"] as const;

const CACHE_REL = ".secrets/qloo-demo-cache.json";

function cachePath(): string {
  return join(process.cwd(), CACHE_REL);
}

export async function readDemoCache<T>(seed: string): Promise<T | null> {
  if (!(DEMO_SEEDS as readonly string[]).includes(seed)) return null;
  try {
    const path = cachePath();
    const text = await readFile(path, "utf8");
    const parsed = JSON.parse(text) as Record<string, T>;
    return parsed[seed] ?? null;
  } catch {
    return null;
  }
}

export async function writeDemoCache(seed: string, value: unknown): Promise<void> {
  if (!(DEMO_SEEDS as readonly string[]).includes(seed)) return;
  try {
    const path = cachePath();
    await mkdir(dirname(path), { recursive: true });
    let current: Record<string, unknown> = {};
    try {
      current = JSON.parse(await readFile(path, "utf8")) as Record<string, unknown>;
    } catch {
      current = {};
    }
    current[seed] = value;
    await writeFile(path, JSON.stringify(current, null, 2), "utf8");
  } catch {
    // Cache is best-effort. A write failure must never break a live lookup.
  }
}
