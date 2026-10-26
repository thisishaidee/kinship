import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { QLOO_CALL_TTL_MS, QLOO_RATE_LIMIT_TTL_MS, createQlooCallCache, qlooCallKey } from "./kinship-qloo-cache.ts";

const OK = { ok: true as const, body: { results: [] } };

describe("qloo call cache", () => {
  it("keeps a short TTL, well under a judge session", () => {
    assert.equal(QLOO_CALL_TTL_MS, 60_000);
    assert.ok(QLOO_RATE_LIMIT_TTL_MS < QLOO_CALL_TTL_MS);
  });

  it("keys identical path and params together, and nothing else", () => {
    const left = new URLSearchParams();
    left.set("query", "Nike");
    left.append("types", "urn:entity:brand");
    const right = new URLSearchParams();
    right.set("query", "Adidas");
    right.append("types", "urn:entity:brand");
    assert.equal(qlooCallKey("/search", left), qlooCallKey("/search", new URLSearchParams(left)));
    assert.notEqual(qlooCallKey("/search", left), qlooCallKey("/search", right));
    assert.notEqual(qlooCallKey("/search", left), qlooCallKey("/v2/insights", left));
  });

  it("answers an identical call inside the TTL without a second load", async () => {
    let loads = 0;
    const cached = createQlooCallCache();
    await cached("a", async () => (loads++, OK), 0);
    const again = await cached("a", async () => (loads++, OK), QLOO_CALL_TTL_MS - 1);
    assert.equal(loads, 1);
    assert.equal(again, OK);
  });

  it("loads again once the TTL has passed", async () => {
    let loads = 0;
    const cached = createQlooCallCache();
    await cached("a", async () => (loads++, OK), 0);
    await cached("a", async () => (loads++, { ok: true, body: { results: [loads] } }), QLOO_CALL_TTL_MS);
    assert.equal(loads, 2);
  });

  it("does not reuse a different call", async () => {
    let loads = 0;
    const cached = createQlooCallCache();
    await cached("a", async () => (loads++, OK), 0);
    await cached("b", async () => (loads++, OK), 0);
    assert.equal(loads, 2);
  });

  it("shares one in-flight load across concurrent identical calls", async () => {
    let loads = 0;
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const cached = createQlooCallCache();
    const load = async () => {
      loads += 1;
      await gate;
      return OK;
    };
    const first = cached("a", load, 0);
    const second = cached("a", load, 0);
    release();
    const [a, b] = await Promise.all([first, second]);
    assert.equal(loads, 1);
    assert.equal(a, b);
  });

  it("remembers a 429 briefly and does not remember a timeout", async () => {
    let limited = 0;
    let timedOut = 0;
    const cached = createQlooCallCache();
    await cached("limit", async () => (limited++, { ok: false, status: 429 }), 0);
    await cached("limit", async () => (limited++, { ok: false, status: 429 }), QLOO_RATE_LIMIT_TTL_MS - 1);
    await cached("limit", async () => (limited++, { ok: false, status: 429 }), QLOO_RATE_LIMIT_TTL_MS);
    await cached("down", async () => (timedOut++, { ok: false, status: 0 }), 0);
    await cached("down", async () => (timedOut++, { ok: false, status: 0 }), 1);
    assert.equal(limited, 2);
    assert.equal(timedOut, 2);
  });

  it("drops the oldest entry once the map is full", async () => {
    let loads = 0;
    const cached = createQlooCallCache({ maxEntries: 2 });
    await cached("a", async () => (loads++, OK), 0);
    await cached("b", async () => (loads++, OK), 0);
    await cached("c", async () => (loads++, OK), 0);
    await cached("a", async () => (loads++, OK), 1);
    assert.equal(loads, 4);
  });
});
