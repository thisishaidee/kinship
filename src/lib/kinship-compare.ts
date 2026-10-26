import {
  formatAffinity,
  loadTasteGraph,
  searchEntity,
  seedKindFromLabel,
  type Candidate,
  type GraphCategory,
  type QlooGetter,
  type ResolvedEntity,
  type SeedProblem,
} from "./kinship-resolve.ts";

export type Overlap = {
  name: string;
  entityId: string;
  category: string;
  leftScore: number;
  rightScore: number;
};

export type CompareEvidence = {
  left: { name: string; typeLabel: string };
  right: { name: string; typeLabel: string };
  overlaps: { entityId?: string; name: string; category: string; leftScore: string; rightScore: string }[];
};

export type CompareSide = { entity: ResolvedEntity; tags: string[] };

export type CompareResult =
  | {
      status: "matched";
      left: ResolvedEntity;
      right: ResolvedEntity;
      overlaps: Overlap[];
      explanation: string;
      explanationSource: "agent" | "model" | "scores";
      evidence: CompareEvidence;
    }
  | {
      status: "ambiguous";
      leftSeed: string;
      rightSeed: string;
      leftCandidates?: Candidate[];
      rightCandidates?: Candidate[];
      leftExact: boolean;
      rightExact: boolean;
      leftEntity?: ResolvedEntity;
      rightEntity?: ResolvedEntity;
    }
  | { status: "no-match"; side: "left" | "right" | "both"; leftSeed: string; rightSeed: string }
  | { status: "missing-key" }
  | { status: "refused" }
  | { status: "unavailable" }
  | { status: "bad-seed"; reason: SeedProblem; side: "left" | "right" };

type CompareCandidate = ResolvedEntity & { detail?: string };

const SAFE_WORDS = new Set<string>([
  "qloo", "these", "both", "this", "audience", "affinity", "scores", "no", "kinship", "they", "those", "figures", "data",
  "fans", "listeners", "viewers", "shoppers", "audiences", "the", "their", "across", "together",
  // Ordinary capitalized openers and category nouns. They name no entity, so the name check lets them through.
  "most", "many", "some", "each", "people", "followers", "buyers", "consumers", "customers", "customer",
  "also", "because", "so", "plus", "and", "or", "but", "if", "as", "while", "who", "which", "what", "when",
  "it", "its", "this", "that", "they", "those", "these", "there", "here", "in", "on", "for", "with", "from",
  "fan", "follower", "buyer", "consumer", "brand", "brands", "sports", "music", "fashion", "streetwear", "sneaker", "sneakers",
  "pop", "hip", "hop", "rap", "shared", "overlap", "similar", "natural", "match", "group", "groups",
]);

// Claims a sentence must never make, even when every name and score is real.
// Relationship or news claims the Qloo payload never returns. Any of these means the model invented context.
const UNSUPPORTED_CONTEXT = /\b(recently|just|newly|signed|signs|signing|endorse[sd]?|sponsor(s|ed)?|deal with|contract with|launched a|collab(orat(ed|es|ing))?|announced|partnered|teamed up)\b/i;

const FORBIDDEN_CLAIM = /partners with|partner with|proves|proof|shows they|guarantee|proof that|will sign|should sign|sign tomorrow|guarantees|guaranteed|sealed|secured deal|confirmed deal|confirmed partnership|partnership is available|guarantee|probability|percent chance/i;

export function sharedAffinities(left: GraphCategory[], right: GraphCategory[]): Overlap[] {
  const leftHits = strongestById(left);
  const rightHits = strongestById(right);
  const overlaps: Overlap[] = [];
  for (const [entityId, hit] of leftHits) {
    const other = rightHits.get(entityId);
    if (!other) continue;
    overlaps.push({
      name: hit.name,
      entityId,
      category: hit.category,
      leftScore: hit.score,
      rightScore: other.score,
    });
  }
  return overlaps.sort((a, b) => Math.min(b.leftScore, b.rightScore) - Math.min(a.leftScore, a.rightScore) || Math.max(b.leftScore, b.rightScore) - Math.max(a.leftScore, a.rightScore));
}

export function fallbackExplanation(evidence: CompareEvidence): string {
  const [first, second] = evidence.overlaps;
  if (!first) {
    return `${evidence.left.name} and ${evidence.right.name} have no shared entity in these Qloo results.`;
  }
  // Numbers live in the shared-fans list, never in the explanation sentence.
  const lead = `Both pull toward ${first.name}`;
  const tail = second ? ` and ${second.name}` : "";
  return `${lead}${tail}.`;
}

// Plain-sentence rule shared by every model-written line: no digits, no percentages or decimals,
// no typographic dashes (em, en, figure, hyphen, minus) and no spaced hyphen, no question marks.
// A hyphen inside a name (Jay-Z, street-style) is allowed because Qloo returns it that way.
const TYPOGRAPHIC_DASH = /[\u2010-\u2015\u2212\u2E3A\u2E3B]/;
const SPACED_HYPHEN = /\s-\s/;
export function isPlainSentence(text: string): boolean {
  if (/\d/.test(text)) return false;
  if (TYPOGRAPHIC_DASH.test(text) || SPACED_HYPHEN.test(text)) return false;
  if (/\?/.test(text)) return false;
  return true;
}

export function groundedExplanation(text: string | null, evidence: CompareEvidence): { text: string; source: "model" | "scores" } {
  const fallback = fallbackExplanation(evidence);
  if (!text) return { text: fallback, source: "scores" };
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (/model draft|outside the returned|cites those scores|stack trace/i.test(cleaned)) {
    return { text: fallback, source: "scores" };
  }
  const sentences = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean);
  if (sentences.length < 1 || sentences.length > 2) return { text: fallback, source: "scores" };
  if (FORBIDDEN_CLAIM.test(cleaned)) {
    return { text: fallback, source: "scores" };
  }
  // The explanation carries no numbers of any kind, no dashes, and no questions.
  if (!isPlainSentence(cleaned)) return { text: fallback, source: "scores" };
  // A name is grounded when Qloo returned it.
  const allowedWords = new Set<string>(SAFE_WORDS);
  for (const name of [
    evidence.left.name,
    evidence.right.name,
    evidence.left.typeLabel,
    evidence.right.typeLabel,
    ...evidence.overlaps.flatMap((overlap) => [overlap.name, overlap.category]),
  ]) {
    for (const word of name.split(/\s+/)) allowedWords.add(word.toLowerCase().replace(/[^a-z0-9']/g, ""));
  }
  for (const sentence of sentences) {
    const words = sentence.replace(/[().,"“”]/g, "").split(/\s+/);
    for (const word of words) {
      // Possessives ("Rihanna's") and trailing punctuation are not part of the name.
      const bare = word.replace(/['’]s$/i, "").replace(/[^A-Za-z0-9]+$/, "");
      if (!/^[A-Z]/.test(bare)) continue;
      const plain = bare.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (plain && !allowedWords.has(plain)) return { text: fallback, source: "scores" };
    }
  }
  // Relationship or news claims the returned data never contains are invented context.
  if (UNSUPPORTED_CONTEXT.test(cleaned)) return { text: fallback, source: "scores" };
  // A second sentence must add something the data supports: a returned entity name or score.
  if (sentences.length === 2) {
    const second = sentences[1].toLowerCase();
    const addsEntity = evidence.overlaps.some((overlap) => second.includes(overlap.name.toLowerCase()));
    if (!addsEntity) return { text: fallback, source: "scores" };
  }
  return { text: cleaned, source: "model" };
}

export function readCompare(
  input: unknown,
): { ok: true; left: string; right: string; leftId?: string; rightId?: string } | { ok: false; reason: SeedProblem; side: "left" | "right" } {
  if (!input || typeof input !== "object") return { ok: false, reason: "invalid", side: "left" };
  const record = input as { left?: unknown; right?: unknown; leftId?: unknown; rightId?: unknown };
  const left = readSide(record.left, record.leftId);
  if (!left.ok) return { ...left, side: "left" };
  const right = readSide(record.right, record.rightId);
  if (!right.ok) return { ...right, side: "right" };
  return { ok: true, left: left.seed, right: right.seed, leftId: left.entityId, rightId: right.entityId };
}

export async function compareKinship(
  input: unknown,
  deps: {
    key: () => Promise<string | undefined>;
    get: QlooGetter;
    explain: (evidence: CompareEvidence) => Promise<string | null>;
    // Optional agent path: one agent run per side. Null when either side fails or times out.
    // overlaps carries the real left and right score for every shared entity, so each side's check can use both.
    agent?: (
      sides: { left: CompareSide; right: CompareSide },
      overlaps: CompareEvidence["overlaps"],
    ) => Promise<{ left: string; right: string } | null>;
  },
): Promise<CompareResult> {
  const parsed = readCompare(input);
  if (!parsed.ok) return { status: "bad-seed", reason: parsed.reason, side: parsed.side };
  const key = await deps.key();
  if (!key) return { status: "missing-key" };
  const [left, right] = await Promise.all([
    searchEntity(deps.get, key, parsed.left, parsed.leftId),
    searchEntity(deps.get, key, parsed.right, parsed.rightId),
  ]);
  if (left.status === "refused" || right.status === "refused") return { status: "refused" };
  if (left.status === "unavailable" || right.status === "unavailable") return { status: "unavailable" };
  if (left.status === "none" || right.status === "none") {
    const side = left.status === "none" && right.status === "none" ? "both" : left.status === "none" ? "left" : "right";
    return { status: "no-match", side, leftSeed: parsed.left, rightSeed: parsed.right };
  }
  if (left.status === "choose" || right.status === "choose") {
    return {
      status: "ambiguous",
      leftSeed: parsed.left,
      rightSeed: parsed.right,
      leftCandidates: left.status === "choose" ? left.candidates : undefined,
      rightCandidates: right.status === "choose" ? right.candidates : undefined,
      leftExact: left.status === "choose" ? left.exact : true,
      rightExact: right.status === "choose" ? right.exact : true,
      leftEntity: left.status === "use" ? publicEntity(left.entity) : undefined,
      rightEntity: right.status === "use" ? publicEntity(right.entity) : undefined,
    };
  }
  const [leftGraph, rightGraph] = await Promise.all([
    loadTasteGraph(deps.get, key, left.entity.entityId, 20, 20, left.tags, seedKindFromLabel(left.entity.typeLabel)),
    loadTasteGraph(deps.get, key, right.entity.entityId, 20, 20, right.tags, seedKindFromLabel(right.entity.typeLabel)),
  ]);
  if (leftGraph === "refused" || rightGraph === "refused") return { status: "refused" };
  const overlaps = sharedAffinities(leftGraph, rightGraph).slice(0, 6);
  const evidence: CompareEvidence = {
    left: { name: left.entity.name, typeLabel: left.entity.typeLabel },
    right: { name: right.entity.name, typeLabel: right.entity.typeLabel },
    overlaps: overlaps.map((overlap) => ({
      name: overlap.name,
      category: overlap.category,
      leftScore: formatAffinity(overlap.leftScore),
      rightScore: formatAffinity(overlap.rightScore),
    })),
  };
  const agentTexts = deps.agent
    ? await deps.agent(
        {
          left: { entity: left.entity, tags: left.tags },
          right: { entity: right.entity, tags: right.tags },
        },
        evidence.overlaps,
      ).catch(() => null)
    : null;
  // Each side already passed groundedExplanation against its own Qloo reads.
  // Checking the join again, against only the shared overlaps, drops those
  // sentences whenever a partner is not in the intersection, and the page
  // falls through to the one-shot line. Show the two sentences instead.
  const merged = agentTexts ? mergeAgentTexts(agentTexts) : "";
  const explanation = merged
    ? { text: merged, source: "agent" as const }
    : groundedExplanation(await deps.explain(evidence), evidence);
  return {
    status: "matched",
    left: publicEntity(left.entity),
    right: publicEntity(right.entity),
    overlaps,
    explanation: explanation.text,
    explanationSource: explanation.source,
    evidence,
  };
}

// One validated sentence from each side, kept as the agent wrote it.
// These already passed the checker against that side's Qloo reads.
function firstSentence(text: string): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  const sentence = cleaned.split(/(?<=[.!?])\s+/)[0] ?? "";
  if (!sentence) return "";
  return /[.!?]$/.test(sentence) ? sentence : `${sentence}.`;
}

// Two sides that open with the same three words, or share a five-word run, read as an echo.
// Shorter ordinary phrases ("so the two", "fans also follow") do not count, so a valid pair is kept.
function sharesEchoPhrase(a: string, b: string): boolean {
  const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9' ]/g, " ").split(/\s+/).filter(Boolean);
  const left = words(a);
  const right = words(b);
  if (left.length >= 3 && right.length >= 3 && left.slice(0, 3).join(" ") === right.slice(0, 3).join(" ")) return true;
  const grams = (w: string[]) => {
    const out = new Set<string>();
    for (let i = 0; i + 5 <= w.length; i++) out.add(w.slice(i, i + 5).join(" "));
    return out;
  };
  const seen = grams(left);
  for (const g of grams(right)) if (seen.has(g)) return true;
  return false;
}

function mergeAgentTexts(texts: { left: string; right: string }): string {
  const left = firstSentence(texts.left);
  const right = firstSentence(texts.right);
  if (!left || !right) return "";
  if (left.toLowerCase() === right.toLowerCase()) return left;
  if (sharesEchoPhrase(left, right)) return "";
  return `${left} ${right}`;
}

function strongestById(graph: GraphCategory[]): Map<string, { name: string; score: number; category: string }> {
  const hits = new Map<string, { name: string; score: number; category: string }>();
  for (const category of graph) {
    if (category.status !== "ok") continue;
    for (const hit of category.hits) {
      const existing = hits.get(hit.entityId);
      if (!existing || hit.score > existing.score) hits.set(hit.entityId, { name: hit.name, score: hit.score, category: category.label });
    }
  }
  return hits;
}

function publicEntity(entity: CompareCandidate): ResolvedEntity {
  return { name: entity.name, typeLabel: entity.typeLabel, entityId: entity.entityId };
}

function readSide(seed: unknown, entityId: unknown): { ok: true; seed: string; entityId?: string } | { ok: false; reason: SeedProblem } {
  if (typeof seed !== "string") return { ok: false, reason: "invalid" };
  const trimmed = seed.trim();
  if (!trimmed) return { ok: false, reason: "empty" };
  if (trimmed.length > 120) return { ok: false, reason: "too-long" };
  if (entityId == null) return { ok: true, seed: trimmed };
  if (typeof entityId !== "string" || !entityId.trim()) return { ok: false, reason: "invalid" };
  return { ok: true, seed: trimmed, entityId: entityId.trim() };
}
