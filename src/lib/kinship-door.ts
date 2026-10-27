import { createServerFn } from "@tanstack/react-start";
import { compareKinship, type CompareEvidence, type CompareSide } from "@/lib/kinship-compare";
import { formatAffinity, readRequest, resolveKinship, searchEntity, seedKindFromLabel, type QlooGetter, type ResolveResult } from "@/lib/kinship-resolve";
import { DEMO_SEEDS, readDemoCache, writeDemoCache } from "@/lib/kinship-demo-cache.server";
import { groundedExplanation } from "@/lib/kinship-compare";
import { createQlooCallCache, qlooCallKey } from "@/lib/kinship-qloo-cache";
import { cardLine, pageCardLines } from "@/lib/kinship-card-line";

export type {
  Candidate,
  GraphHit,
  GraphStatus,
  Pitch,
  ResolveResult,
  ResolvedEntity,
  UncheckedCategory,
} from "@/lib/kinship-resolve";
export type { CompareEvidence, CompareResult, Overlap } from "@/lib/kinship-compare";
export { cardLine } from "@/lib/kinship-card-line";
export { copyFailureMessage, formatAffinity, isLatestRequest, partnerSearchHref } from "@/lib/kinship-resolve";

async function qlooKey(): Promise<string | undefined> {
  const { env } = await import("@/lib/env.server");
  const fromEnv = env("QLOO_API_KEY");
  if (fromEnv) return fromEnv;
  try {
    const { readFile } = await import("node:fs/promises");
    const text = (await readFile("/workspace/.secrets/qloo-api-key", "utf8")).trim();
    return text || undefined;
  } catch {
    return undefined;
  }
}

const qlooCalls = createQlooCallCache();

const qlooGet: QlooGetter = async (key, path, params) =>
  qlooCalls(qlooCallKey(path, params), async () => {
    try {
      const response = await fetch(`https://hackathon.api.qloo.com${path}?${params}`, {
        headers: { "X-Api-Key": key },
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) return { ok: false, status: response.status };
      return { ok: true, body: await response.json() };
    } catch {
      return { ok: false, status: 0 };
    }
  });

// Live lookup with a private fallback for the three demo seeds. A successful Qloo
// answer can be saved locally; if the key dies or quota runs out, that saved
// answer is served and marked cached. The file never arms on Vercel.
async function resolveWithDemoFallback(input: unknown): Promise<ResolveResult> {
  const seed = typeof (input as { seed?: unknown })?.seed === "string" ? ((input as { seed: string }).seed).trim() : "";
  const demo = (DEMO_SEEDS as readonly string[]).includes(seed);
  const live = await resolveKinship(input, { key: qlooKey, get: qlooGet });
  if (demo && (live.status === "matched" || live.status === "ambiguous")) {
    await writeDemoCache(seed, live);
    return live;
  }
  if (demo && (live.status === "missing-key" || live.status === "unavailable" || live.status === "refused")) {
    const saved = await readDemoCache<ResolveResult>(seed);
    if (saved) return saved;
  }
  return live;
}

// Per-card pitch line: one grounded sentence per partner card, built only from that
// card's returned hits. Reuses the compare validator (groundedExplanation). If Groq is
// unavailable or the output fails the check, the card keeps its template line. Fails quiet.
async function pitchForCard(seedName: string, partnerType: string, hits: { name: string; score: number }[]): Promise<string | null> {
  const { env } = await import("@/lib/env.server");
  const key = env("GROQ_API_KEY");
  if (!key || hits.length === 0) return null;
  const top = hits.slice(0, 2).map((hit) => ({ name: hit.name, score: formatAffinity(hit.score) }));
  const evidence = {
    left: { name: seedName, typeLabel: partnerType },
    right: { name: partnerType, typeLabel: partnerType },
    overlaps: top.map((hit) => ({ name: hit.name, category: partnerType, leftScore: hit.score, rightScore: hit.score })),
  };
  try {
    const { groqText } = await import("@/lib/groq.server");
    const text = await groqText({
      apiKey: key,
      system: CARD_PITCH_PROMPT,
      user: JSON.stringify({ seed: seedName, partnerType, hits: top }),
      maxTokens: 512,
      timeoutMs: 15000,
    });
    if (!text) return null;
    const checked = groundedExplanation(text, evidence as never);
    return checked.source === "model" ? checked.text : null;
  } catch {
    return null;
  }
}

const CARD_PITCH_PROMPT =
  "Write exactly one short sentence pitching the named partner type, using only the JSON in the user message. Name only entities and numbers in the JSON. Do not claim a partnership exists or will succeed. Do not add causes or facts not in the JSON.";

export const resolveKinshipSeed = createServerFn({ method: "POST" })
  .validator((input: unknown) => input)
  .handler(async ({ data }) => {
    const result = await resolveWithDemoFallback(data);
    if (result.status !== "matched") return result;
    const agentLines = await Promise.all(
      result.pitches.map((pitch) => pitchForCard(result.entity.name, pitch.partnerType, pitch.hits)),
    );
    // One page-wide pass: agent lines that repeat a phrase or name another card's partner are dropped.
    const lines = pageCardLines(
      result.entity.name,
      result.pitches.map((pitch, index) => ({ partnerType: pitch.partnerType, hits: pitch.hits, agentLine: agentLines[index] })),
    );
    const pitches = result.pitches.map((pitch, index) => ({ ...pitch, lines: lines[index], line: lines[index][0] ?? "" }));
    return { ...result, pitches };
  });

// Agentic pass: Groq chooses which Qloo reads to make (capped), then writes one
// grounded sentence. Any failure returns null and the caller keeps the fixed pipeline.
// The step trace is returned so the UI can show what the agent asked.
export type AgentPassReason =
  | "not-configured"
  | "bad-request"
  | "no-entity"
  | "agent-error"
  | import("@/lib/kinship-agent").AgentFallback;

export type AgentPassResult =
  | { status: "pitch"; text: string; steps: import("@/lib/kinship-agent").AgentStep[] }
  | { status: "fallback"; reason: AgentPassReason; steps: import("@/lib/kinship-agent").AgentStep[] };

export const runAgenticPitch = createServerFn({ method: "POST" })
  .validator((input: unknown) => input)
  .handler(async ({ data }): Promise<AgentPassResult> => {
    try {
      const { env } = await import("@/lib/env.server");
      const groqKey = env("GROQ_API_KEY");
      const qKey = await qlooKey();
      if (!groqKey || !qKey) {
        console.error(`agentic: not-configured (groq=${groqKey ? "set" : "missing"}, qloo=${qKey ? "set" : "missing"})`);
        return { status: "fallback", reason: "not-configured", steps: [] };
      }
      const request = readRequest(data);
      if (!request.ok) {
        console.error("agentic: bad-request");
        return { status: "fallback", reason: "bad-request", steps: [] };
      }
      const found = await searchEntity(qlooGet, qKey, request.seed, request.entityId);
      if (found.status !== "use") {
        console.error("agentic: no-entity");
        return { status: "fallback", reason: "no-entity", steps: [] };
      }
      const { runKinshipAgent, shouldRetryAgent } = await import("@/lib/kinship-agent");
      const { createGroqModel, createQlooTools } = await import("@/lib/kinship-agent-adapters.server");
      const SINGLE_AGENT_WALL_MS = 45_000;
      const started = Date.now();
      const runOnce = (wallMs: number) =>
        runKinshipAgent(
          found.entity,
          {
            model: createGroqModel(groqKey, found.entity.name),
            tools: createQlooTools(qKey, qlooGet, found.tags, seedKindFromLabel(found.entity.typeLabel)),
          },
          { wallMs },
        );
      // One silent retry before the thin fallback, same rule as compare: fast misses only.
      const first = await runOnce(SINGLE_AGENT_WALL_MS);
      if (first.status === "pitch") return { status: "pitch", text: first.text, steps: first.steps };
      console.error(`agentic: ${first.reason}`);
      const elapsed = Date.now() - started;
      if (!shouldRetryAgent(first.reason, elapsed, SINGLE_AGENT_WALL_MS)) {
        return { status: "fallback", reason: first.reason, steps: first.steps };
      }
      const second = await runOnce(SINGLE_AGENT_WALL_MS - elapsed);
      if (second.status === "pitch") return { status: "pitch", text: second.text, steps: second.steps };
      console.error(`agentic retry: ${second.reason}`);
      return { status: "fallback", reason: second.reason, steps: second.steps };
    } catch (error) {
      console.error(`agentic: agent-error (${error instanceof Error ? error.name : "unknown"})`);
      return { status: "fallback", reason: "agent-error", steps: [] };
    }
  });

// Compare agent path: one runKinshipAgent loop per side, in parallel, capped to a short wall
// clock so the compare request still returns quickly. Any failure or timeout returns null and
// compare keeps the single-call explanation.
const COMPARE_AGENT_WALL_MS = 45_000;
// Each side gets a different opening angle so the two sentences do not echo each other.
const COMPARE_ANGLES = {
  left: "For this side, open with the partner's name, then say its fans already follow this name, in a sentence shaped differently from the other side.",
  right: "For this side, open with this name's own audience, then say why the partner suits it, in a sentence shaped differently from the other side.",
} as const;
async function compareAgentPitches(
  sides: { left: CompareSide; right: CompareSide },
  overlaps: CompareEvidence["overlaps"],
): Promise<{ left: string; right: string } | null> {
  const { env } = await import("@/lib/env.server");
  const groqKey = env("GROQ_API_KEY");
  const qKey = await qlooKey();
  if (!groqKey || !qKey) return null;
  const { runKinshipAgent, shouldRetryAgent } = await import("@/lib/kinship-agent");
  const { createGroqModel, createQlooTools } = await import("@/lib/kinship-agent-adapters.server");
  const attempt = async (side: CompareSide, column: "left" | "right", wallMs: number) => {
    const outcome = await runKinshipAgent(
      side.entity,
      {
        model: createGroqModel(groqKey, side.entity.name, COMPARE_ANGLES[column]),
        tools: createQlooTools(qKey, qlooGet, side.tags, seedKindFromLabel(side.entity.typeLabel)),
      },
      { wallMs, pair: { side: column, overlaps } },
    );
    return outcome;
  };
  // One silent retry per side. A fast miss (bad draft, a transient model error) gets a second run
  // with the time left on the clock. A slow miss (timeout) is not retried, so the request stays short.
  const runSide = async (side: CompareSide, column: "left" | "right"): Promise<string | null> => {
    const started = Date.now();
    const first = await attempt(side, column, COMPARE_AGENT_WALL_MS);
    if (first.status === "pitch") return first.text;
    console.error(`agentic-compare: ${first.reason}`);
    const elapsed = Date.now() - started;
    if (!shouldRetryAgent(first.reason, elapsed, COMPARE_AGENT_WALL_MS)) return null;
    const second = await attempt(side, column, COMPARE_AGENT_WALL_MS - elapsed);
    if (second.status === "pitch") return second.text;
    console.error(`agentic-compare retry: ${second.reason}`);
    return null;
  };
  // Sequential, not parallel: two agent runs at once double the per-minute Groq burn and trigger 429s.
  // Each side still gets its own 45s wall.
  const left = await runSide(sides.left, "left");
  const right = await runSide(sides.right, "right");
  return left && right ? { left, right } : null;
}

export const compareKinshipSeeds = createServerFn({ method: "POST" })
  .validator((input: unknown) => input)
  .handler(async ({ data }) =>
    compareKinship(data, { key: qlooKey, get: qlooGet, explain: explainWithGroq, agent: compareAgentPitches }),
  );

const EXPLAIN_PROMPT =
  "You explain a pairing using only the JSON in the user message. Write exactly two sentences. First sentence: name the top one or two shared entities from the JSON, in the shape Both pull toward NAME. Second sentence: one plain-words line about what the two audiences share, written differently from the first sentence and never starting with 'Both pull toward', still using only entity names present in the JSON. Write no digits, percentages, or decimals; express overlap in words only, such as 'most of the same fans'. Use plain commas, never em dashes. Never use the words 'entity' or 'taste graph'. Do not claim a partnership exists, is available, or will succeed. Do not add causes, history, genres, or locations that are not fields in the JSON. If overlaps is empty, say nothing.";

async function explainWithGroq(evidence: CompareEvidence): Promise<string | null> {
  const { env } = await import("@/lib/env.server");
  const key = env("GROQ_API_KEY");
  if (!key) return null;
  const { groqText } = await import("@/lib/groq.server");
  try {
    // groqText already retries once after 5s on HTTP 429. Any other failure returns null
    // and the caller keeps the template sentence.
    return await groqText({
      apiKey: key,
      system: EXPLAIN_PROMPT,
      user: JSON.stringify(evidence),
      maxTokens: 512,
      timeoutMs: 20000,
    });
  } catch {
    return null;
  }
}

export type HeroResult = { name: string; score: string; cached?: boolean };

// Landing hero: the top hit of up to three partner categories for the example seed,
// fetched live through the same server proxy. Null when Qloo cannot answer, so the
// page shows no names or numbers rather than invented ones.
// Module-level hero cache: landing loader and /app auto-Nike reuse one set of Qloo calls.
// Successful rows live 10 minutes; a null (Qloo down or no match) is retried after 60 seconds.
const HERO_TTL_MS = 10 * 60 * 1000;
const HERO_NULL_TTL_MS = 60 * 1000;
let heroCache: { at: number; ttl: number; rows: HeroResult[] | null } | null = null;

async function fetchHeroRows(): Promise<HeroResult[] | null> {
  try {
    const result = await resolveWithDemoFallback({ seed: "Nike" });
    if (result.status !== "matched") return null;
    const top = result.pitches
      .map((pitch) => pitch.hits[0])
      .filter((hit): hit is NonNullable<typeof hit> => Boolean(hit))
      .slice(0, 3)
      .map((hit) => ({
        name: hit.name,
        score: formatAffinity(hit.score),
        ...(result.cached ? { cached: true as const } : {}),
      }));
    return top.length === 3 ? top : null;
  } catch {
    return null;
  }
}

export const getHeroResults = createServerFn({ method: "GET" }).handler(async (): Promise<HeroResult[] | null> => {
  const now = Date.now();
  if (heroCache && now - heroCache.at < heroCache.ttl) return heroCache.rows;
  const rows = await fetchHeroRows();
  heroCache = { at: now, ttl: rows ? HERO_TTL_MS : HERO_NULL_TTL_MS, rows };
  return rows;
});
