// Server-only Groq client (OpenAI-compatible chat completions). Used for compare
// explanations, card pitch lines, and the agentic pitch pass. Keys never leave the server.

export const GROQ_MODEL = "openai/gpt-oss-20b";
export const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const RETRY_DELAY_MS = 5000;

export type GroqMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: GroqToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type GroqToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };

export type GroqTool = {
  type: "function";
  function: { name: string; description: string; parameters: Record<string, unknown> };
};

export type GroqReply = { content: string | null; toolCalls: GroqToolCall[] };

// Carries only the HTTP status (or null for network/shape errors). Never the key or the body.
export class GroqError extends Error {
  readonly status: number | null;
  readonly reason: string;
  constructor(status: number | null, message: string) {
    super(message);
    this.name = "GroqError";
    this.status = status;
    this.reason = message;
  }
}

// Key rotation. When the primary key keeps returning 429 after the retries, calls switch to
// GROQ_API_KEY_2 through a module-level cursor. The cursor holds for one rate-limit window
// (Groq limits are per minute), then the primary key is tried again.
const BACKUP_WINDOW_MS = 60_000;
let backupSwitchedAt: number | null = null;

function backupKey(): string | null {
  const value = process.env.GROQ_API_KEY_2?.trim();
  return value ? value : null;
}

function activeKey(apiKey: string): string {
  if (backupSwitchedAt !== null && Date.now() - backupSwitchedAt < BACKUP_WINDOW_MS) {
    const backup = backupKey();
    if (backup) return backup;
  }
  return apiKey;
}

function logRateLimit(response: Response, status: number): void {
  const remaining = response.headers.get("x-ratelimit-remaining-requests") ?? "n/a";
  const limit = response.headers.get("x-ratelimit-limit-requests") ?? "n/a";
  console.log(`groq: ratelimit status=${status} remaining=${remaining} limit=${limit}`);
}

export async function groqChat(input: {
  apiKey: string;
  messages: GroqMessage[];
  maxTokens: number;
  timeoutMs: number;
  tools?: GroqTool[];
  reasoningEffort?: "low" | "medium" | "high";
}): Promise<GroqReply> {
  const body: Record<string, unknown> = {
    model: GROQ_MODEL,
    messages: input.messages,
    temperature: 0,
    // gpt-oss counts reasoning against the completion budget and reads
    // max_completion_tokens. max_tokens alone comes back with empty content.
    max_tokens: input.maxTokens,
    max_completion_tokens: input.maxTokens,
  };
  if (input.tools && input.tools.length > 0) body.tools = input.tools;
  body.reasoning_effort = input.reasoningEffort ?? "low";
  let response: Response;
  const key = activeKey(input.apiKey);
  try {
    response = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(input.timeoutMs),
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "TimeoutError" || name === "AbortError") throw new GroqError(null, "timeout");
    throw new GroqError(null, "network");
  }
  logRateLimit(response, response.status);
  if (!response.ok) throw new GroqError(response.status, `http ${response.status}`);
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new GroqError(null, "bad-response");
  }
  const message = (data as { choices?: { message?: { content?: unknown; tool_calls?: unknown } }[] })?.choices?.[0]?.message;
  if (!message || typeof message !== "object") throw new GroqError(null, "bad-response");
  const content = readContent(message.content);
  const toolCalls = Array.isArray(message.tool_calls) ? (message.tool_calls as GroqToolCall[]) : [];
  return { content, toolCalls };
}

function readContent(content: unknown): string | null {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return null;
  const text = content
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string") return (part as { text: string }).text;
      return "";
    })
    .join("");
  return text.trim() ? text : null;
}

// Free-tier Groq limits are per minute, so a 429 usually clears only after several seconds. A 429
// gets two retries (6s, then 12s). Other transient failures (a network blip, a malformed body)
// get one retry after 5 seconds. A timeout is never retried, because the caller's wall clock is the limit.
// Any other failure, or a 429 that survives every retry, is thrown to the caller, which falls back quietly.
export const GROQ_429_DELAYS_MS = [6000, 12000];
export async function groqChatRetry(
  input: Parameters<typeof groqChat>[0],
  delays: { rateLimit?: number[]; transient?: number } = {},
): Promise<GroqReply> {
  const rateLimit = delays.rateLimit ?? GROQ_429_DELAYS_MS;
  const transient = delays.transient ?? RETRY_DELAY_MS;
  let waits = 0;
  for (;;) {
    try {
      return await groqChat(input);
    } catch (error) {
      if (!(error instanceof GroqError)) throw error;
      if (error.reason === "timeout") throw error;
      if (error.status === 429) {
        if (waits >= rateLimit.length) {
          // Primary key is exhausted. Switch once to the backup key and give it the same backoff.
          const onBackup = activeKey(input.apiKey) !== input.apiKey;
          if (onBackup || !backupKey()) throw error;
          backupSwitchedAt = Date.now();
          console.log("groq: switched to backup key");
          waits = 0;
          continue;
        }
        await new Promise((resolve) => setTimeout(resolve, rateLimit[waits]));
        waits++;
        continue;
      }
      if (error.reason !== "network" && error.reason !== "bad-response") throw error;
      if (waits > 0) throw error;
      waits++;
      await new Promise((resolve) => setTimeout(resolve, transient));
    }
  }
}

// Plain-text completion used by the card pitch and compare explanation.
export async function groqText(input: {
  apiKey: string;
  system: string;
  user: string;
  maxTokens: number;
  timeoutMs: number;
}): Promise<string | null> {
  const reply = await groqChatRetry({
    apiKey: input.apiKey,
    messages: [
      { role: "system", content: input.system },
      { role: "user", content: input.user },
    ],
    maxTokens: input.maxTokens,
    timeoutMs: input.timeoutMs,
  });
  return typeof reply.content === "string" && reply.content.trim() ? reply.content : null;
}
