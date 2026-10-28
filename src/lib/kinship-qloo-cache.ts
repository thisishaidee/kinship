// Short-lived memory for identical Qloo calls. One compare repeats the same
// /search and /v2/insights URLs from the agent loop, and a burst of judges
// hits the same demo seeds. Successes live for one minute. A 429 is remembered
// briefly so the burst does not keep paying for the same refusal. Anything
// else (timeout, 5xx) is not stored, so the next try still reaches Qloo.
export type QlooCallResult = { ok: true; body: unknown } | { ok: false; status: number };

export const QLOO_CALL_TTL_MS = 600_000;
export const QLOO_RATE_LIMIT_TTL_MS = 15_000;

export function qlooCallKey(path: string, params: URLSearchParams): string {
  return `${path}?${params.toString()}`;
}

export function createQlooCallCache(options?: { ttlMs?: number; rateLimitTtlMs?: number; maxEntries?: number }) {
  const ttlMs = options?.ttlMs ?? QLOO_CALL_TTL_MS;
  const rateLimitTtlMs = options?.rateLimitTtlMs ?? QLOO_RATE_LIMIT_TTL_MS;
  const maxEntries = options?.maxEntries ?? 200;
  const store = new Map<string, { at: number; ttl: number; value: QlooCallResult }>();
  const inflight = new Map<string, Promise<QlooCallResult>>();

  return async function cachedCall(
    key: string,
    load: () => Promise<QlooCallResult>,
    now: number = Date.now(),
  ): Promise<QlooCallResult> {
    const hit = store.get(key);
    if (hit && now - hit.at < hit.ttl) return hit.value;
    if (hit) store.delete(key);
    const pending = inflight.get(key);
    if (pending) return pending;
    const promise = load()
      .then((value) => {
        const ttl = value.ok ? ttlMs : value.status === 429 ? rateLimitTtlMs : 0;
        if (ttl > 0) {
          store.set(key, { at: now, ttl, value });
          while (store.size > maxEntries) {
            const oldest = store.keys().next().value;
            if (oldest === undefined) break;
            store.delete(oldest);
          }
        }
        return value;
      })
      .finally(() => {
        inflight.delete(key);
      });
    inflight.set(key, promise);
    return promise;
  };
}
