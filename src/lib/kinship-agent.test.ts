import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AGENT_MAX_CALLS, AGENT_MAX_ROUNDS, runKinshipAgent, type AgentModel, type AgentTools, type AgentTurn, type ToolResult } from "./kinship-agent.ts";
import type { ResolvedEntity } from "./kinship-resolve.ts";

const SEED: ResolvedEntity = { name: "Nike", typeLabel: "Brand", entityId: "seed-1" };
const ADIDAS = "adidas-1";
const RIHANNA = "rihanna-1";

function scriptedModel(turns: AgentTurn[]): AgentModel & { seen: (ToolResult[] | null)[]; finals: boolean[] } {
  const seen: (ToolResult[] | null)[] = [];
  const finals: boolean[] = [];
  let index = 0;
  return {
    seen,
    finals,
    async next(results, final) {
      seen.push(results);
      finals.push(final);
      const turn = turns[index] ?? { kind: "final", text: "" };
      index += 1;
      return turn;
    },
  };
}

function tools(overrides: Partial<AgentTools> = {}): AgentTools {
  return {
    async findEntity(query) {
      return { ok: true, candidates: [{ name: `${query} Co`, entityId: "found-1", typeLabel: "Brand" }] };
    },
    async readPartners(entityId, category) {
      if (entityId === "seed-1" && category === "brand") {
        return { ok: true, hits: [{ name: "Adidas", entityId: ADIDAS, score: 0.953 }, { name: "Puma", entityId: "puma-1", score: 0.912 }] };
      }
      if (entityId === "seed-1" && category === "artist") {
        return { ok: true, hits: [{ name: "Rihanna", entityId: RIHANNA, score: 0.959 }] };
      }
      return { ok: true, hits: [] };
    },
    ...overrides,
  };
}

const GOOD_TEXT = "Both pull toward Adidas (0.953 / 0.953) and Puma (0.912 / 0.912).";

describe("runKinshipAgent", () => {
  it("runs the model's reads, then accepts a grounded final sentence", async () => {
    const model = scriptedModel([
      { kind: "calls", calls: [{ name: "read_partners", args: { entity_id: "seed-1", category: "brand" } }] },
      { kind: "final", text: GOOD_TEXT },
    ]);
    const out = await runKinshipAgent(SEED, { model, tools: tools() });
    assert.equal(out.status, "pitch");
    if (out.status !== "pitch") return;
    assert.equal(out.text, GOOD_TEXT);
    assert.deepEqual(out.steps, [{ kind: "read", label: "read brand overlap for Nike", ok: true, count: 2 }]);
    assert.equal(model.seen[1]?.[0]?.ok, true);
  });

  it("rejects a final sentence that names something Qloo did not return", async () => {
    const model = scriptedModel([
      { kind: "calls", calls: [{ name: "read_partners", args: { entity_id: "seed-1", category: "brand" } }] },
      { kind: "final", text: "Both pull toward Reebok (0.953 / 0.953)." },
    ]);
    const out = await runKinshipAgent(SEED, { model, tools: tools() });
    assert.deepEqual(out.status === "fallback" ? out.reason : null, "invalid-output");
  });

  it("rejects a final sentence with a score Qloo did not return", async () => {
    const model = scriptedModel([
      { kind: "calls", calls: [{ name: "read_partners", args: { entity_id: "seed-1", category: "brand" } }] },
      { kind: "final", text: "Both pull toward Adidas (0.999 / 0.999)." },
    ]);
    const out = await runKinshipAgent(SEED, { model, tools: tools() });
    assert.equal(out.status, "fallback");
  });

  it("rejects a final sentence that claims a partnership", async () => {
    const model = scriptedModel([
      { kind: "calls", calls: [{ name: "read_partners", args: { entity_id: "seed-1", category: "brand" } }] },
      { kind: "final", text: "Adidas is a confirmed partnership for Nike (0.953 / 0.953)." },
    ]);
    const out = await runKinshipAgent(SEED, { model, tools: tools() });
    assert.equal(out.status, "fallback");
  });

  it("falls back when the model returns text without ever reading Qloo", async () => {
    const model = scriptedModel([{ kind: "final", text: GOOD_TEXT }]);
    const out = await runKinshipAgent(SEED, { model, tools: tools() });
    assert.deepEqual(out.status === "fallback" ? out.reason : null, "no-evidence");
  });

  it("caps total tool calls at the budget and forces a final turn", async () => {
    const calls = Array.from({ length: 4 }, () => ({ name: "read_partners" as const, args: { entity_id: "seed-1", category: "brand" as const } }));
    const turns: AgentTurn[] = [
      { kind: "calls", calls },
      { kind: "calls", calls },
      { kind: "calls", calls },
      { kind: "calls", calls },
    ];
    const model = scriptedModel(turns);
    const out = await runKinshipAgent(SEED, { model, tools: tools() });
    assert.equal(out.status, "fallback");
    const executed = out.steps.length;
    assert.ok(executed <= AGENT_MAX_CALLS, `executed ${executed} calls`);
    assert.ok(model.finals.some((flag) => flag), "model was never told it was out of budget");
  });

  it("stops after the round cap even if the model keeps asking", async () => {
    const forever: AgentTurn = { kind: "calls", calls: [{ name: "find_entity", args: { query: "nike" } }] };
    const model = scriptedModel(Array.from({ length: 10 }, () => forever));
    const out = await runKinshipAgent(SEED, { model, tools: tools() });
    assert.equal(out.status, "fallback");
    const rounds = model.seen.length;
    assert.ok(rounds <= AGENT_MAX_ROUNDS + 1, `model asked ${rounds} times`);
  });

  it("refuses a read for an entity it never saw, and records the failed step", async () => {
    const model = scriptedModel([
      { kind: "calls", calls: [{ name: "read_partners", args: { entity_id: "made-up", category: "brand" } }] },
      { kind: "final", text: GOOD_TEXT },
    ]);
    const out = await runKinshipAgent(SEED, { model, tools: tools() });
    assert.equal(out.steps[0]?.ok, false);
    assert.equal(model.seen[1]?.[0]?.ok, false);
  });

  it("refuses an unknown category", async () => {
    const model = scriptedModel([
      { kind: "calls", calls: [{ name: "read_partners", args: { entity_id: "seed-1", category: "planet" as never } }] },
      { kind: "final", text: GOOD_TEXT },
    ]);
    const out = await runKinshipAgent(SEED, { model, tools: tools() });
    assert.equal(out.steps[0]?.ok, false);
  });

  it("treats a model crash as a fallback, not an error", async () => {
    const model: AgentModel = {
      async next() {
        throw new Error("503 high demand");
      },
    };
    const out = await runKinshipAgent(SEED, { model, tools: tools() });
    assert.deepEqual(out.status === "fallback" ? out.reason : null, "model-error");
  });

  it("records a failed Qloo read as a visible step and keeps going", async () => {
    const model = scriptedModel([
      { kind: "calls", calls: [{ name: "read_partners", args: { entity_id: "seed-1", category: "brand" } }] },
      { kind: "final", text: GOOD_TEXT },
    ]);
    const out = await runKinshipAgent(SEED, {
      model,
      tools: tools({ async readPartners() { return { ok: false }; } }),
    });
    assert.equal(out.steps[0]?.ok, false);
    assert.equal(out.status, "fallback");
  });

  it("never lets a step name a score it did not get back", async () => {
    const model = scriptedModel([
      { kind: "calls", calls: [{ name: "read_partners", args: { entity_id: "seed-1", category: "artist" } }] },
      { kind: "final", text: GOOD_TEXT },
    ]);
    const out = await runKinshipAgent(SEED, { model, tools: tools() });
    // artist read returned only Rihanna, so Adidas and Puma are not evidence.
    assert.equal(out.status, "fallback");
  });
});
