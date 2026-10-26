import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createStatusCache, STATUS_TTL_MS, type GroqStatus } from "./groq-status.server.ts";

const OK: GroqStatus = { ok: true, reason: "ok" };

describe("groq status cache", () => {
  it("uses a five minute TTL", () => {
    assert.equal(STATUS_TTL_MS, 5 * 60 * 1000);
  });

  it("answers repeat requests inside the TTL without another ping", async () => {
    let pings = 0;
    const get = createStatusCache(async () => (pings++, OK));
    await get(1000);
    await get(1000 + STATUS_TTL_MS - 1);
    assert.equal(pings, 1);
  });

  it("pings again once the TTL has passed", async () => {
    let pings = 0;
    const get = createStatusCache(async () => (pings++, OK));
    await get(0);
    await get(STATUS_TTL_MS);
    assert.equal(pings, 2);
  });

  it("shares one in-flight check across concurrent callers", async () => {
    let pings = 0;
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const get = createStatusCache(async () => {
      pings++;
      await gate;
      return OK;
    });
    const a = get(0);
    const b = get(0);
    const c = get(0);
    release();
    assert.deepEqual(await Promise.all([a, b, c]), [OK, OK, OK]);
    assert.equal(pings, 1);
  });

  it("caches a failure too, so a down provider is not pinged on every request", async () => {
    let pings = 0;
    const fail: GroqStatus = { ok: false, reason: "timeout", detail: "request timed out" };
    const get = createStatusCache(async () => (pings++, fail));
    assert.equal((await get(0)).reason, "timeout");
    assert.equal((await get(1)).reason, "timeout");
    assert.equal(pings, 1);
  });
});
