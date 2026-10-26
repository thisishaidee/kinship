import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { demoCacheDecision, labelCachedServe, readDemoCache, resetDemoCacheForTests, writeDemoCache } from "./kinship-demo-cache.server.ts";

describe("demo cache gate", () => {
  it("stays off on Vercel and when the filesystem cannot be written", () => {
    assert.equal(demoCacheDecision({ vercel: "1", writable: true }), false);
    assert.equal(demoCacheDecision({ vercel: "1", writable: false }), false);
    assert.equal(demoCacheDecision({ vercel: undefined, writable: false }), false);
    assert.equal(demoCacheDecision({ vercel: " ", writable: true }), false);
    assert.equal(demoCacheDecision({ vercel: undefined, writable: true }), true);
    assert.equal(demoCacheDecision({ vercel: "", writable: true }), true);
  });

  it("labels a match or a chooser and refuses every other status", () => {
    assert.equal(labelCachedServe({ status: "unavailable" }), null);
    assert.equal(labelCachedServe({ status: "missing-key" }), null);
    const labeled = labelCachedServe({ status: "matched", seed: "Nike" });
    assert.equal(labeled?.cached, true);
    assert.equal(labeled?.seed, "Nike");
  });

  it("does not read or write while VERCEL is set, and labels a local serve", async () => {
    const dir = await mkdtemp(join(tmpdir(), "kinship-demo-"));
    const file = join(dir, "cache.json");
    const previous = process.env.VERCEL;
    try {
      await writeFile(file, JSON.stringify({ Nike: { status: "matched", seed: "Nike" } }));
      process.env.VERCEL = "1";
      resetDemoCacheForTests(file);
      assert.equal(await readDemoCache("Nike"), null);
      await writeDemoCache("Nike", { status: "matched", seed: "Nike", cached: true, extra: "nope" });
      const blocked = JSON.parse(await readFile(file, "utf8")) as { Nike: { extra?: string } };
      assert.equal(blocked.Nike.extra, undefined);

      delete process.env.VERCEL;
      resetDemoCacheForTests(file);
      const saved = await readDemoCache<{ status: string; seed: string }>("Nike");
      assert.equal(saved?.cached, true);
      assert.equal(saved?.status, "matched");

      await writeDemoCache("Radiohead", { status: "ambiguous", seed: "Radiohead", cached: true, candidates: [] });
      const written = JSON.parse(await readFile(file, "utf8")) as {
        Radiohead: { cached?: boolean; status: string };
      };
      assert.equal(written.Radiohead.cached, undefined);
      assert.equal(written.Radiohead.status, "ambiguous");
      resetDemoCacheForTests(file);
      const radiohead = await readDemoCache("Radiohead");
      assert.equal(radiohead?.cached, true);
      assert.equal(await readDemoCache("Not a demo"), null);
    } finally {
      if (previous === undefined) delete process.env.VERCEL;
      else process.env.VERCEL = previous;
      resetDemoCacheForTests(null);
      await rm(dir, { recursive: true, force: true });
    }
  });
});
