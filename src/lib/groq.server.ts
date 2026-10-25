// Server-only Groq client (OpenAI-compatible chat completions). Used for compare
// explanations, card pitch lines, and the agentic pitch pass. Keys never leave the server.

export const GROQ_MODEL = "llama-3.3-70b-versatile";
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
  constructor(status: number | null, message: string) {
    super(message);
    this.name = "GroqError";
    this.status = status;
  }
}

export async function groqChat(input: {
  apiKey: string;
  messages: GroqMessage[];
  maxTokens: number;
  timeoutMs: number;
  tools?: GroqTool[];
}): Promise<GroqReply> {
  const body: Record<string, unknown> = {
    model: GROQ_MODEL,
    messages: input.messages,
    temperature: 0,
    max_tokens: input.maxTokens,
  };
  if (input.tools && input.tools.length > 0) body.tools = input.tools;
  let response: Response;
  try {
    response = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${input.apiKey}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(input.timeoutMs),
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "TimeoutError" || name === "AbortError") throw new GroqError(null, "timeout");
    throw new GroqError(null, "network");
  }
  if (!response.ok) throw new GroqError(response.status, `http ${response.status}`);
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new GroqError(null, "bad-response");
  }
  const message = (data as { choices?: { message?: { content?: unknown; tool_calls?: unknown } }[] })?.choices?.[0]?.message;
  if (!message || typeof message !== "object") throw new GroqError(null, "bad-response");
  const content = typeof message.content === "string" ? message.content : null;
  const toolCalls = Array.isArray(message.tool_calls) ? (message.tool_calls as GroqToolCall[]) : [];
  return { content, toolCalls };
}

// One retry after 5 seconds when Groq answers HTTP 429 (free-tier per-minute limit).
// Any other failure, or a second 429, is thrown to the caller, which falls back quietly.
export async function groqChatRetry(input: Parameters<typeof groqChat>[0]): Promise<GroqReply> {
  try {
    return await groqChat(input);
  } catch (error) {
    if (!(error instanceof GroqError) || error.status !== 429) throw error;
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    return groqChat(input);
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
