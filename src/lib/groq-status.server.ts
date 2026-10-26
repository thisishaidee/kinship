export type GroqReason =
  | "ok"
  | "missing-key"
  | "http-401"
  | "http-403"
  | "http-429"
  | "http-4xx"
  | "http-500"
  | "timeout"
  | "bad-response"
  | "unknown-error";

export type GroqStatus = { ok: boolean; reason: GroqReason; detail?: string };

// Only the HTTP status and a short, sanitized message are returned. Never key material,
// never the raw response body.
function sanitize(message: string): string {
  return message
    .replace(/gsk_[0-9A-Za-z_-]+/g, "[redacted]")
    .replace(/[\r\n\t]+/g, " ")
    .slice(0, 100);
}

function classify(error: unknown): { reason: GroqReason; detail: string } {
  const e = error as { status?: unknown; name?: unknown; message?: unknown };
  const status = typeof e?.status === "number" ? e.status : undefined;
  const message = typeof e?.message === "string" ? e.message : String(error ?? "");
  const name = typeof e?.name === "string" ? e.name : "";
  if (message === "timeout" || name === "TimeoutError" || name === "AbortError") {
    return { reason: "timeout", detail: "request timed out" };
  }
  if (status === 401) return { reason: "http-401", detail: sanitize(`http ${status}`) };
  if (status === 403) return { reason: "http-403", detail: sanitize(`http ${status}`) };
  if (status === 429) return { reason: "http-429", detail: sanitize(`http ${status}`) };
  if (status === 500 || status === 502 || status === 503 || status === 504) {
    return { reason: "http-500", detail: sanitize(`http ${status}`) };
  }
  if (typeof status === "number" && status >= 400 && status < 500) {
    return { reason: "http-4xx", detail: sanitize(`http ${status}`) };
  }
  if (message === "bad-response") return { reason: "bad-response", detail: "unexpected reply shape" };
  return { reason: "unknown-error", detail: sanitize(message || "unknown error") };
}

// Public endpoint protection: one live ping per STATUS_TTL_MS at most, and concurrent
// callers share the in-flight check instead of each billing a Groq request.
export const STATUS_TTL_MS = 5 * 60 * 1000;

export function createStatusCache(load: () => Promise<GroqStatus>, ttlMs = STATUS_TTL_MS) {
  let cached: { at: number; value: GroqStatus } | null = null;
  let inflight: Promise<GroqStatus> | null = null;
  return async function get(now: number = Date.now()): Promise<GroqStatus> {
    if (cached && now - cached.at < ttlMs) return cached.value;
    if (inflight) return inflight;
    inflight = load()
      .then((value) => {
        cached = { at: now, value };
        return value;
      })
      .finally(() => {
        inflight = null;
      });
    return inflight;
  };
}

const liveStatus = createStatusCache(() => checkGroq());

export async function groqStatus(): Promise<GroqStatus> {
  return liveStatus();
}

async function checkGroq(): Promise<GroqStatus> {
  const { env } = await import("@/lib/env.server");
  const key = env("GROQ_API_KEY");
  if (!key) return { ok: false, reason: "missing-key", detail: "GROQ_API_KEY is not set" };
  const { groqChatRetry } = await import("@/lib/groq.server");
  try {
    // Small ping. gpt-oss is a reasoning model, so allow enough tokens for
    // thinking plus the visible one-word reply.
    const reply = await groqChatRetry({
      apiKey: key,
      messages: [{ role: "user", content: "Reply with the single word ok. Do not explain." }],
      maxTokens: 256,
      timeoutMs: 20000,
      reasoningEffort: "low",
    });
    if (typeof reply.content === "string" && reply.content.trim()) return { ok: true, reason: "ok" };
    return { ok: false, reason: "bad-response", detail: "empty reply" };
  } catch (error) {
    const c = classify(error);
    return { ok: false, reason: c.reason, detail: c.detail };
  }
}

export async function groqReady(): Promise<boolean> {
  return (await groqStatus()).ok;
}
