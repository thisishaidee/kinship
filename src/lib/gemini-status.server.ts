export type GeminiReason =
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

export type GeminiStatus = { ok: boolean; reason: GeminiReason; detail?: string };

// Only the HTTP status and a short, sanitized message are returned. Never key material,
// never the raw response body.
function sanitize(message: string): string {
  return message
    .replace(/AIza[0-9A-Za-z_-]+/g, "[redacted]")
    .replace(/[\r\n\t]+/g, " ")
    .slice(0, 100);
}

function classify(error: unknown): { reason: GeminiReason; detail: string } {
  const e = error as { status?: unknown; code?: unknown; name?: unknown; message?: unknown };
  const status = typeof e?.status === "number" ? e.status : typeof e?.code === "number" ? e.code : undefined;
  const message = typeof e?.message === "string" ? e.message : String(error ?? "");
  const name = typeof e?.name === "string" ? e.name : "";
  if (name === "TimeoutError" || name === "AbortError") return { reason: "timeout", detail: "request timed out" };
  if (status === 401) return { reason: "http-401", detail: sanitize(`http ${status}`) };
  if (status === 403) return { reason: "http-403", detail: sanitize(`http ${status}`) };
  if (status === 429) return { reason: "http-429", detail: sanitize(`http ${status}`) };
  if (status === 500 || status === 502 || status === 503 || status === 504) {
    return { reason: "http-500", detail: sanitize(`http ${status}`) };
  }
  if (typeof status === "number" && status >= 400 && status < 500) {
    return { reason: "http-4xx", detail: sanitize(`http ${status}`) };
  }
  return { reason: "unknown-error", detail: sanitize(message || "unknown error") };
}

export async function geminiStatus(): Promise<GeminiStatus> {
  const { env } = await import("@/lib/env.server");
  const key = env("GEMINI_API_KEY");
  if (!key) return { ok: false, reason: "missing-key", detail: "GEMINI_API_KEY is not set" };
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey: key });
  let last: GeminiStatus = { ok: false, reason: "unknown-error" };
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: "Reply with the single word ok.",
        config: {
          temperature: 0,
          maxOutputTokens: 32,
          thinkingConfig: { thinkingBudget: 0 },
          abortSignal: AbortSignal.timeout(15000),
        },
      });
      if (typeof response.text === "string" && response.text.trim()) return { ok: true, reason: "ok" };
      last = { ok: false, reason: "bad-response", detail: "empty reply" };
    } catch (error) {
      const c = classify(error);
      last = { ok: false, reason: c.reason, detail: c.detail };
      // Auth and quota failures will not clear on retry; stop early.
      if (c.reason === "http-401" || c.reason === "http-403" || c.reason === "http-429") break;
    }
  }
  return last;
}

export async function geminiReady(): Promise<boolean> {
  return (await geminiStatus()).ok;
}
