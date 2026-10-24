import { groundedExplanation, type CompareEvidence } from "./kinship-compare.ts";
import type { Candidate, GraphHit, ResolvedEntity } from "./kinship-resolve.ts";

// Agentic pitch loop. The model decides which Qloo reads to make (as tools), within a
// hard budget. The loop itself never reaches Qloo or Gemini: both are injected, so the
// caps and the validator can be tested without the network. Any failure returns a
// fallback outcome, and the caller keeps the fixed pipeline.

export const AGENT_MAX_CALLS = 6;
export const AGENT_MAX_ROUNDS = 3;
const MAX_QUERY_LENGTH = 120;
const MAX_EVIDENCE = 12;

export const PARTNER_CATEGORIES = ["brand", "place", "destination", "artist"] as const;
export type PartnerCategory = (typeof PARTNER_CATEGORIES)[number];

export type AgentCall =
  | { name: "find_entity"; args: { query: string } }
  | { name: "read_partners"; args: { entity_id: string; category: PartnerCategory } };

export type AgentStep = {
  kind: "search" | "read";
  label: string;
  ok: boolean;
  count: number;
};

export type ToolResult = {
  name: AgentCall["name"];
  ok: boolean;
  data: unknown;
};

export type AgentTurn = { kind: "calls"; calls: AgentCall[] } | { kind: "final"; text: string };

// `results` is null on the first turn. `final` means no more tool calls are allowed.
export type AgentModel = {
  next(results: ToolResult[] | null, final: boolean): Promise<AgentTurn>;
};

export type AgentTools = {
  findEntity(query: string): Promise<{ ok: true; candidates: Candidate[] } | { ok: false }>;
  readPartners(entityId: string, category: PartnerCategory): Promise<{ ok: true; hits: GraphHit[] } | { ok: false }>;
};

export type AgentOutcome =
  | { status: "pitch"; text: string; steps: AgentStep[]; evidence: CompareEvidence }
  | { status: "fallback"; reason: AgentFallback; steps: AgentStep[] };

export type AgentFallback = "model-error" | "budget" | "invalid-output" | "no-evidence" | "still-calling";

type Evidence = Map<string, { name: string; category: string; score: number }>;

export async function runKinshipAgent(
  seed: ResolvedEntity,
  deps: { model: AgentModel; tools: AgentTools },
): Promise<AgentOutcome> {
  const steps: AgentStep[] = [];
  const known = new Map<string, string>([[seed.entityId, seed.name]]);
  const evidence: Evidence = new Map();
  let calls = 0;
  let rounds = 0;
  let results: ToolResult[] | null = null;

  for (;;) {
    const final = calls >= AGENT_MAX_CALLS || rounds >= AGENT_MAX_ROUNDS;
    let turn: AgentTurn;
    try {
      turn = await deps.model.next(results, final);
    } catch {
      return fallback("model-error", steps);
    }

    if (turn.kind === "final") {
      if (evidence.size === 0) return fallback("no-evidence", steps);
      const checked = groundedExplanation(turn.text, toEvidence(seed, evidence));
      if (checked.source !== "model") return fallback("invalid-output", steps);
      return { status: "pitch", text: checked.text, steps, evidence: toEvidence(seed, evidence) };
    }

    if (final) return fallback(calls >= AGENT_MAX_CALLS ? "budget" : "still-calling", steps);

    results = [];
    for (const call of turn.calls) {
      if (calls >= AGENT_MAX_CALLS) {
        results.push({ name: call.name, ok: false, data: { error: "budget spent" } });
        continue;
      }
      calls += 1;
      results.push(await executeCall(call, { tools: deps.tools, known, evidence, steps }));
    }
    rounds += 1;
  }
}

async function executeCall(
  call: AgentCall,
  state: { tools: AgentTools; known: Map<string, string>; evidence: Evidence; steps: AgentStep[] },
): Promise<ToolResult> {
  if (call.name === "find_entity") {
    const query = typeof call.args?.query === "string" ? call.args.query.trim() : "";
    if (!query || query.length > MAX_QUERY_LENGTH) {
      state.steps.push({ kind: "search", label: "asked qloo about an invalid name", ok: false, count: 0 });
      return { name: call.name, ok: false, data: { error: "bad query" } };
    }
    const found = await state.tools.findEntity(query);
    if (!found.ok) {
      state.steps.push({ kind: "search", label: `asked qloo about "${query}"`, ok: false, count: 0 });
      return { name: call.name, ok: false, data: { error: "qloo did not answer" } };
    }
    for (const candidate of found.candidates) state.known.set(candidate.entityId, candidate.name);
    state.steps.push({ kind: "search", label: `asked qloo about "${query}"`, ok: true, count: found.candidates.length });
    return {
      name: call.name,
      ok: true,
      data: { candidates: found.candidates.map((c) => ({ entity_id: c.entityId, name: c.name, type: c.typeLabel })) },
    };
  }

  if (call.name === "read_partners") {
    const entityId = typeof call.args?.entity_id === "string" ? call.args.entity_id.trim() : "";
    const category = call.args?.category;
    const subject = state.known.get(entityId);
    if (!subject || !(PARTNER_CATEGORIES as readonly string[]).includes(String(category))) {
      state.steps.push({ kind: "read", label: "tried to read an entity it had not seen", ok: false, count: 0 });
      return { name: call.name, ok: false, data: { error: "unknown entity or category" } };
    }
    const read = await state.tools.readPartners(entityId, category as PartnerCategory);
    if (!read.ok) {
      state.steps.push({ kind: "read", label: `read ${category} overlap for ${subject}`, ok: false, count: 0 });
      return { name: call.name, ok: false, data: { error: "qloo did not answer" } };
    }
    for (const hit of read.hits) {
      state.known.set(hit.entityId, hit.name);
      const existing = state.evidence.get(hit.name);
      if (!existing || hit.score > existing.score) state.evidence.set(hit.name, { name: hit.name, category, score: hit.score });
    }
    state.steps.push({ kind: "read", label: `read ${category} overlap for ${subject}`, ok: true, count: read.hits.length });
    return {
      name: call.name,
      ok: true,
      data: { hits: read.hits.map((hit) => ({ entity_id: hit.entityId, name: hit.name, score: hit.score.toFixed(3) })) },
    };
  }

  return { name: (call as { name: string }).name as AgentCall["name"], ok: false, data: { error: "unknown tool" } };
}

function toEvidence(seed: ResolvedEntity, evidence: Evidence): CompareEvidence {
  const overlaps = [...evidence.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_EVIDENCE)
    .map((entry) => ({ name: entry.name, category: entry.category, leftScore: entry.score.toFixed(3), rightScore: entry.score.toFixed(3) }));
  return { left: { name: seed.name, typeLabel: seed.typeLabel }, right: { name: seed.name, typeLabel: seed.typeLabel }, overlaps };
}

function fallback(reason: AgentFallback, steps: AgentStep[]): AgentOutcome {
  return { status: "fallback", reason, steps };
}
