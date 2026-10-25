import { createServerFn } from "@tanstack/react-start";
import { compareKinship, type CompareEvidence } from "@/lib/kinship-compare";
import { formatAffinity, readRequest, resolveKinship, searchEntity, seedKindFromLabel, type QlooGetter, type ResolveResult } from "@/lib/kinship-resolve";
import { DEMO_SEEDS, readDemoCache, writeDemoCache } from "@/lib/kinship-demo-cache.server";
import { groundedExplanation } from "@/lib/kinship-compare";

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

const qlooGet: QlooGetter = async (key, path, params) => {
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
};

// Live lookup with a private fallback for the three demo seeds. A successful Qloo
// answer is saved to a gitignored file; if the key dies or quota runs out, the last
// saved answer is served instead. Only a live match or ambiguity is ever saved.
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
// card's returned hits. Reuses the compare validator (groundedExplanation). If Gemini is
// unavailable or the output fails the check, the card keeps its template line. Fails quiet.
async function pitchForCard(seedName: string, partnerType: string, hits: { name: string; score: number }[]): Promise<string | null> {
  const { env } = await import("@/lib/env.server");
  const key = env("GEMINI_API_KEY");
  if (!key || hits.length === 0) return null;
  const top = hits.slice(0, 2).map((hit) => ({ name: hit.name, score: formatAffinity(hit.score) }));
  const evidence = {
    left: { name: seedName, typeLabel: partnerType },
    right: { name: partnerType, typeLabel: partnerType },
    overlaps: top.map((hit) => ({ name: hit.name, category: partnerType, leftScore: hit.score, rightScore: hit.score })),
  };
  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey: key });
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: JSON.stringify({ seed: seedName, partnerType, hits: top }),
      config: {
        systemInstruction: CARD_PITCH_PROMPT,
        temperature: 0,
        maxOutputTokens: 120,
        thinkingConfig: { thinkingBudget: 0 },
        abortSignal: AbortSignal.timeout(15000),
      },
    });
    const text = response.text;
    if (typeof text !== "string" || !text.trim()) return null;
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
    const pitches = await Promise.all(
      result.pitches.map(async (pitch) => {
        const line = await pitchForCard(result.entity.name, pitch.partnerType, pitch.hits);
        return line ? { ...pitch, line } : pitch;
      }),
    );
    return { ...result, pitches };
  });

// Agentic pass: Gemini chooses which Qloo reads to make (capped), then writes one
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
      const geminiKey = env("GEMINI_API_KEY");
      const qKey = await qlooKey();
      if (!geminiKey || !qKey) return { status: "fallback", reason: "not-configured", steps: [] };
      const request = readRequest(data);
      if (!request.ok) return { status: "fallback", reason: "bad-request", steps: [] };
      const found = await searchEntity(qlooGet, qKey, request.seed, request.entityId);
      if (found.status !== "use") return { status: "fallback", reason: "no-entity", steps: [] };
      const { runKinshipAgent } = await import("@/lib/kinship-agent");
      const { createGeminiModel, createQlooTools } = await import("@/lib/kinship-agent-adapters.server");
      const outcome = await runKinshipAgent(found.entity, {
        model: createGeminiModel(geminiKey, found.entity.name),
        tools: createQlooTools(qKey, qlooGet, found.tags, seedKindFromLabel(found.entity.typeLabel)),
      });
      if (outcome.status === "pitch") return { status: "pitch", text: outcome.text, steps: outcome.steps };
      return { status: "fallback", reason: outcome.reason, steps: outcome.steps };
    } catch {
      return { status: "fallback", reason: "agent-error", steps: [] };
    }
  });

export const compareKinshipSeeds = createServerFn({ method: "POST" })
  .validator((input: unknown) => input)
  .handler(async ({ data }) => compareKinship(data, { key: qlooKey, get: qlooGet, explain: explainWithGemini }));

const EXPLAIN_PROMPT =
  "You explain a pairing using only the JSON in the user message. Write exactly one sentence in this shape: Both pull toward NAME (LEFT / RIGHT) and NAME (LEFT / RIGHT). Use the top shared entities and their two scores from the JSON, without quotes, and do not use the words 'entity' or 'taste graph'. You may only name entities and facts present in the returned Qloo scores; if you cannot stay within them, say nothing and the fallback sentence will be used. Do not claim a partnership exists, is available, or will succeed. Do not add causes, history, genres, or locations that are not fields in the JSON. If overlaps is empty, say nothing.";

async function explainWithGemini(evidence: CompareEvidence): Promise<string | null> {
  const { env } = await import("@/lib/env.server");
  const key = env("GEMINI_API_KEY");
  if (!key) return null;
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey: key });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: JSON.stringify(evidence),
        config: {
          systemInstruction: EXPLAIN_PROMPT,
          temperature: 0,
          maxOutputTokens: 256,
          thinkingConfig: { thinkingBudget: 0 },
          abortSignal: AbortSignal.timeout(20000),
        },
      });
      const text = response.text;
      if (typeof text === "string" && text.trim()) return text;
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (attempt === 1 || !/503|429|UNAVAILABLE|high demand/i.test(message)) return null;
    }
  }
  return null;
}

export type HeroResult = { name: string; score: string };

// Landing hero: the top hit of up to three partner categories for the example seed,
// fetched live through the same server proxy. Null when Qloo cannot answer, so the
// page shows no names or numbers rather than invented ones.
export const getHeroResults = createServerFn({ method: "GET" }).handler(async (): Promise<HeroResult[] | null> => {
  try {
    const result = await resolveWithDemoFallback({ seed: "Nike" });
    if (result.status !== "matched") return null;
    const top = result.pitches
      .map((pitch) => pitch.hits[0])
      .filter((hit): hit is NonNullable<typeof hit> => Boolean(hit))
      .slice(0, 3)
      .map((hit) => ({ name: hit.name, score: formatAffinity(hit.score) }));
    return top.length === 3 ? top : null;
  } catch {
    return null;
  }
});
