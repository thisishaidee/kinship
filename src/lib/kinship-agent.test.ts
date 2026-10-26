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

  it("keeps the last grounded sentence when the model adds a preamble", async () => {
    const model = scriptedModel([
      { kind: "calls", calls: [{ name: "read_partners", args: { entity_id: "seed-1", category: "brand" } }] },
      { kind: "final", text: "The model considered several names before answering. Both pull toward Adidas (0.953 / 0.953)." },
    ]);
    const out = await runKinshipAgent(SEED, { model, tools: tools() });
    assert.equal(out.status, "pitch");
    if (out.status !== "pitch") return;
    assert.equal(out.text, "Both pull toward Adidas (0.953 / 0.953).");
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

  it("keeps two different entity ids that share one name as separate evidence", async () => {
    const model = scriptedModel([
      { kind: "calls", calls: [{ name: "read_partners", args: { entity_id: "seed-1", category: "brand" } }] },
      { kind: "calls", calls: [{ name: "read_partners", args: { entity_id: "seed-1", category: "artist" } }] },
      { kind: "final", text: "Both pull toward Adidas (0.953 / 0.953)." },
    ]);
    const twin = tools({
      async readPartners(entityId, category) {
        if (entityId === "seed-1" && category === "brand") {
          return { ok: true, hits: [{ name: "Jordan", entityId: "jordan-brand", score: 0.7 }, { name: "Jordan", entityId: "jordan-athlete", score: 0.6 }] };
        }
        return { ok: true, hits: [] };
      },
    });
    const out = await runKinshipAgent(SEED, { model, tools: twin });
    assert.equal(out.status, "fallback");
    const out2 = await runKinshipAgent(SEED, { model: scriptedModel([
      { kind: "calls", calls: [{ name: "read_partners", args: { entity_id: "seed-1", category: "brand" } }] },
      { kind: "final", text: "Both pull toward Jordan (0.700 / 0.700) and Jordan (0.600 / 0.600)." },
    ]), tools: twin });
    assert.equal(out2.status, "pitch");
    if (out2.status !== "pitch") return;
    const names = out2.evidence.overlaps.map((o) => `${o.entityId}:${o.name}`);
    assert.deepEqual(names, ["jordan-brand:Jordan", "jordan-athlete:Jordan"]);
  });

  it("answers a repeated identical read from cache without a second Qloo call", async () => {
    let qlooCalls = 0;
    const counting = tools({
      async readPartners(entityId, category) {
        qlooCalls += 1;
        return tools().readPartners(entityId, category);
      },
    });
    const model = scriptedModel([
      { kind: "calls", calls: [{ name: "read_partners", args: { entity_id: "seed-1", category: "brand" } }] },
      { kind: "calls", calls: [{ name: "read_partners", args: { entity_id: "seed-1", category: "brand" } }] },
      { kind: "final", text: GOOD_TEXT },
    ]);
    const out = await runKinshipAgent(SEED, { model, tools: counting });
    assert.equal(qlooCalls, 1);
    assert.equal(out.status, "pitch");
    assert.equal(model.seen[2]?.[0]?.ok, true);
  });

  it("rejects a malformed tool call without crashing and counts it as a failed step", async () => {
    const model = scriptedModel([
      { kind: "calls", calls: [{ name: "read_partners", args: null as never }, { name: "drop_table", args: {} } as never] },
      { kind: "calls", calls: [{ name: "read_partners", args: { entity_id: 5 as never, category: "brand" } }] },
      { kind: "final", text: GOOD_TEXT },
    ]);
    const out = await runKinshipAgent(SEED, { model, tools: tools() });
    assert.equal(out.steps.every((step) => step.ok === false), true);
    assert.equal(model.seen[1]?.every((result) => result.ok === false), true);
    assert.equal(out.status, "fallback");
  });

  it("returns a fallback with no evidence when Qloo returns nothing", async () => {
    const model = scriptedModel([
      { kind: "calls", calls: [{ name: "read_partners", args: { entity_id: "seed-1", category: "place" } }] },
      { kind: "final", text: GOOD_TEXT },
    ]);
    const out = await runKinshipAgent(SEED, { model, tools: tools() });
    assert.deepEqual(out.status === "fallback" ? out.reason : null, "no-evidence");
  });

  it("returns a timeout fallback when the wall clock runs out, even if the model is slow", async () => {
    const slow: AgentModel = {
      next: () => new Promise<AgentTurn>((resolve) => setTimeout(() => resolve({ kind: "final", text: GOOD_TEXT }), 200)),
    };
    const out = await runKinshipAgent(SEED, { model: slow, tools: tools() }, { wallMs: 20 });
    assert.deepEqual(out.status === "fallback" ? out.reason : null, "timeout");
  });

  it("returns an exhausted-budget fallback after the call cap is spent", async () => {
    const many = Array.from({ length: AGENT_MAX_CALLS + 2 }, () => ({ name: "read_partners" as const, args: { entity_id: "seed-1", category: "brand" as const } }));
    const model = scriptedModel([{ kind: "calls", calls: many }, { kind: "final", text: GOOD_TEXT }]);
    const out = await runKinshipAgent(SEED, { model, tools: tools() });
    assert.equal(out.status, "pitch");
    const budgetOnly = scriptedModel(Array.from({ length: AGENT_MAX_ROUNDS + 2 }, () => ({ kind: "calls" as const, calls: [{ name: "find_entity" as const, args: { query: "x" } }] })));
    const exhausted = await runKinshipAgent(SEED, { model: budgetOnly, tools: tools() });
    assert.equal(exhausted.status, "fallback");
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

describe("evidence shape", () => {
  it("carries the one score Qloo returned for each partner and invents no second side", async () => {
    const model = scriptedModel([
      { kind: "calls", calls: [{ name: "read_partners", args: { entity_id: "seed-1", category: "brand" } }] },
      { kind: "final", text: GOOD_TEXT },
    ]);
    const out = await runKinshipAgent(SEED, { model, tools: tools() });
    assert.equal(out.status, "pitch");
    if (out.status !== "pitch") return;
    assert.deepEqual(
      out.evidence.overlaps.map((o) => [o.entityId, o.name, o.leftScore, o.rightScore]),
      [
        [ADIDAS, "Adidas", "0.953", "0.953"],
        ["puma-1", "Puma", "0.912", "0.912"],
      ],
    );
  });
});
