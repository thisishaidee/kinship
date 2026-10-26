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

export type CompareResult =
  | {
      status: "matched";
      left: ResolvedEntity;
      right: ResolvedEntity;
      overlaps: Overlap[];
      explanation: string;
      explanationSource: "model" | "scores";
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
  const lead = `Both pull toward ${first.name} (${first.leftScore} / ${first.rightScore})`;
  const tail = second ? ` and ${second.name} (${second.leftScore} / ${second.rightScore})` : "";
  return `${lead}${tail}.`;
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
  const numbers = cleaned.match(/\d+\.\d+/g) ?? [];
  const allowedScores = new Set(evidence.overlaps.flatMap((overlap) => [overlap.leftScore, overlap.rightScore]));
  if (evidence.overlaps.length === 0 ? numbers.length > 0 : numbers.some((number) => !allowedScores.has(number))) {
    return { text: fallback, source: "scores" };
  }
  // If a sentence names an overlap entity, it must cite that entity's own score.
  // Entities are matched by id upstream; here a shared display name counts as one mention,
  // so a sentence must cite a real score from at least one overlap carrying that name.
  for (const sentence of sentences) {
    const lower = sentence.toLowerCase();
    const sentenceScores: string[] = sentence.match(/\d+\.\d+/g) ?? [];
    const names = new Set(evidence.overlaps.map((overlap) => overlap.name.toLowerCase()));
    for (const name of names) {
      if (!lower.includes(name)) continue;
      const scoresForName = evidence.overlaps
        .filter((overlap) => overlap.name.toLowerCase() === name)
        .flatMap((overlap) => [overlap.leftScore, overlap.rightScore]);
      if (!sentenceScores.some((score) => scoresForName.includes(score))) {
        return { text: fallback, source: "scores" };
      }
    }
  }
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
      if (!/^[A-Z]/.test(word)) continue;
      const plain = word.toLowerCase().replace(/[^a-z0-9']/g, "");
      if (plain && !allowedWords.has(plain)) return { text: fallback, source: "scores" };
    }
  }
  // Relationship or news claims the returned data never contains are invented context.
  if (UNSUPPORTED_CONTEXT.test(cleaned)) return { text: fallback, source: "scores" };
  // A second sentence must add something the data supports: a returned entity name or score.
  if (sentences.length === 2) {
    const second = sentences[1].toLowerCase();
    const secondScores = sentences[1].match(/\d+\.\d+/g) ?? [];
    const addsEntity = evidence.overlaps.some((overlap) => second.includes(overlap.name.toLowerCase()));
    const addsScore = secondScores.length > 0;
    if (!addsEntity && !addsScore) return { text: fallback, source: "scores" };
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
  deps: { key: () => Promise<string | undefined>; get: QlooGetter; explain: (evidence: CompareEvidence) => Promise<string | null> },
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
  const explanation = groundedExplanation(await deps.explain(evidence), evidence);
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
