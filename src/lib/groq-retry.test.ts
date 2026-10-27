import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { GROQ_429_DELAYS_MS, groqChatRetry } from "./groq.server.ts";

const realFetch = globalThis.fetch;
const OK_BODY = { choices: [{ message: { content: "hello" } }] };
const input = { apiKey: "k", messages: [{ role: "user" as const, content: "hi" }], maxTokens: 10, timeoutMs: 5000 };

function mockStatuses(statuses: number[]) {
  let calls = 0;
  globalThis.fetch = (async () => {
    const status = statuses[calls++] ?? 200;
    if (status === 200) return new Response(JSON.stringify(OK_BODY), { status: 200 });
    return new Response("rate limited", { status });
  }) as typeof fetch;
  return () => calls;
}

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("groq 429 retry", () => {
  it("uses a longer backoff for rate limits than the transient retry", () => {
    assert.deepEqual(GROQ_429_DELAYS_MS, [6000, 12000]);
  });

  it("recovers when a second 429 is followed by success", async () => {
    const calls = mockStatuses([429, 429, 200]);
    const reply = await groqChatRetry(input, { rateLimit: [0, 0], transient: 0 });
    assert.equal(reply.content, "hello");
    assert.equal(calls(), 3);
  });

  it("gives up after the rate-limit retries are spent", async () => {
    const calls = mockStatuses([429, 429, 429, 200]);
    await assert.rejects(groqChatRetry(input, { rateLimit: [0, 0], transient: 0 }), /http 429/);
    assert.equal(calls(), 3);
  });

  it("does not retry a 500", async () => {
    const calls = mockStatuses([500, 200]);
    await assert.rejects(groqChatRetry(input, { rateLimit: [0, 0], transient: 0 }), /http 500/);
    assert.equal(calls(), 1);
  });
});
