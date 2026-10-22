/** Trim, collapse internal whitespace, then compare in lowercase. Punctuation and accents stay. */
export function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export const SEARCH_TYPES = ["urn:entity:artist", "urn:entity:movie", "urn:entity:brand"] as const;

const TYPE_LABEL: Record<(typeof SEARCH_TYPES)[number], string> = {
  "urn:entity:artist": "Artist",
  "urn:entity:movie": "Film",
  "urn:entity:brand": "Brand",
};

const GRAPH = [
  { id: "brand", label: "Brand", plural: "Brands", filter: "urn:entity:brand" },
  { id: "place", label: "Place", plural: "Places", filter: "urn:entity:place" },
  { id: "destination", label: "Destination", plural: "Destinations", filter: "urn:entity:destination" },
  { id: "artist", label: "Artist", plural: "Artists", filter: "urn:entity:artist" },
] as const;

export type ResolvedEntity = {
  name: string;
  typeLabel: string;
  entityId: string;
};

export type Candidate = ResolvedEntity & { detail?: string };

export type GraphHit = {
  name: string;
  score: number;
  entityId: string;
};

export type GraphCategory = {
  id: (typeof GRAPH)[number]["id"];
  label: string;
  plural: string;
  status: "ok" | "empty" | "unavailable";
  hits: GraphHit[];
};

export type Pitch = {
  id: (typeof GRAPH)[number]["id"];
  partnerType: string;
  hits: GraphHit[];
  line: string;
};

export type UncheckedCategory = {
  id: (typeof GRAPH)[number]["id"];
  label: string;
  line: string;
};

export type GraphStatus = "scored" | "empty" | "partial" | "unavailable";

export type SeedProblem = "empty" | "too-long" | "invalid";

export type ResolveResult =
  | {
      status: "matched";
      seed: string;
      entity: ResolvedEntity;
      pitches: Pitch[];
      graphStatus: GraphStatus;
      unchecked: UncheckedCategory[];
    }
  | { status: "ambiguous"; seed: string; candidates: Candidate[] }
  | { status: "no-match"; seed: string }
  | { status: "missing-key"; seed: string }
  | { status: "refused"; seed: string }
  | { status: "unavailable"; seed: string; entity?: ResolvedEntity; unchecked: UncheckedCategory[] }
  | { status: "bad-seed"; reason: SeedProblem };

export type QlooGetter = (
  key: string,
  path: string,
  params: URLSearchParams,
) => Promise<{ ok: true; body: unknown } | { ok: false; status: number }>;

const PARTNER_TYPE: Record<(typeof GRAPH)[number]["id"], string> = {
  brand: "Brand partner",
  place: "Place partner",
  destination: "Destination partner",
  artist: "Artist partner",
};

export function isLatestRequest(requestId: number, latestId: number): boolean {
  return requestId === latestId;
}

export function copyFailureMessage(): string {
  return "Couldn't copy";
}

export function formatAffinity(score: number): string {
  return score.toFixed(3);
}

export function partnerSearchHref(seedName: string, partnerName: string): string {
  const query = `${seedName} ${partnerName} audience partnership`;
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

export function readRequest(input: unknown): { ok: true; seed: string; entityId?: string } | { ok: false; reason: SeedProblem } {
  if (!input || typeof input !== "object") return { ok: false, reason: "invalid" };
  const record = input as { seed?: unknown; entityId?: unknown };
  if (typeof record.seed !== "string") return { ok: false, reason: "invalid" };
  const seed = record.seed.trim();
  if (!seed) return { ok: false, reason: "empty" };
  if (seed.length > 120) return { ok: false, reason: "too-long" };
  if (record.entityId == null) return { ok: true, seed };
  if (typeof record.entityId !== "string" || !record.entityId.trim()) return { ok: false, reason: "invalid" };
  return { ok: true, seed, entityId: record.entityId.trim() };
}

export function searchParams(seed: string): URLSearchParams {
  const params = new URLSearchParams();
  params.set("query", seed);
  for (const type of SEARCH_TYPES) params.append("types", type);
  params.set("take", "100");
  return params;
}

export function exactCandidates(results: unknown[], seed: string): Candidate[] {
  const needle = normalizeName(seed);
  const seen = new Set<string>();
  const candidates: Candidate[] = [];
  for (const item of results) {
    const candidate = asCandidate(item);
    if (!candidate || seen.has(candidate.entityId)) continue;
    const named = normalizeName(candidate.name) === needle;
    const alias = named ? undefined : englishAlias(item, needle);
    if (!named && !alias) continue;
    seen.add(candidate.entityId);
    if (alias && !candidate.detail) candidate.detail = `Also called ${alias}`;
    candidates.push(candidate);
  }
  return candidates;
}

export function resolutionPlan(
  candidates: Candidate[],
  selectedId?: string,
): { action: "none" } | { action: "choose"; candidates: Candidate[] } | { action: "use"; entity: Candidate } {
  if (selectedId) {
    const chosen = candidates.find((candidate) => candidate.entityId === selectedId);
    if (chosen) return { action: "use", entity: chosen };
    if (candidates.length === 0) return { action: "none" };
    return { action: "choose", candidates };
  }
  if (candidates.length === 0) return { action: "none" };
  if (candidates.length === 1) return { action: "use", entity: candidates[0] };
  return { action: "choose", candidates };
}

const GENERIC_TAGS = new Set([
  "$$",
  "adults",
  "ambitious",
  "atmospheric",
  "b2b",
  "b2c",
  "bold",
  "catchy",
  "charismatic",
  "children",
  "complex",
  "confident",
  "dynamic",
  "energetic",
  "engaging",
  "female",
  "gender-neutral",
  "high",
  "immersive",
  "innovative",
  "intense",
  "lush",
  "male",
  "modern",
  "polished",
  "power",
  "premium",
  "resilient",
  "thoughtful",
  "vibrant",
]);

/** A jammed "&" with no spaces is a bad display name, as in the Drake record returned as "Drake&Orson". */
export function cleanDisplayName(name: string, aliases: string[]): string | null {
  const cleaned = name.trim().replace(/\s+/g, " ");
  if (!cleaned) return null;
  if (!/[A-Za-z]{3,}&[A-Za-z]{3,}/.test(cleaned)) return cleaned;
  const prefix = cleaned.split("&")[0]?.trim() ?? "";
  if (prefix.length < 3) return null;
  const alias = aliases.find((value) => normalizeName(value) === normalizeName(prefix));
  return alias ? prefix : null;
}

export function sharesDomain(seedTags: readonly string[], hitTags: readonly string[]): boolean {
  if (seedTags.length === 0) return true;
  const seed = new Set(seedTags.map((tag) => tag.toLowerCase()));
  return hitTags.some((tag) => {
    const value = tag.toLowerCase();
    return seed.has(value) && !GENERIC_TAGS.has(value);
  });
}

export function asHit(item: unknown, seedId: string, seedTags: readonly string[] = []): GraphHit | null {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  const rawName = typeof record.name === "string" ? record.name.trim() : "";
  const name = cleanDisplayName(rawName, aliasValues(record.properties));
  const entityId = typeof record.entity_id === "string" ? record.entity_id.trim() : "";
  const query = record.query;
  const affinity = query && typeof query === "object" ? (query as { affinity?: unknown }).affinity : undefined;
  if (!name || !entityId || entityId === seedId) return null;
  if (typeof affinity !== "number" || !Number.isFinite(affinity)) return null;
  if (!sharesDomain(seedTags, tagNames(record.tags))) return null;
  return { name, entityId, score: affinity };
}

export function buildPitches(seedName: string, graph: GraphCategory[]): Pitch[] {
  return graph
    .filter((category) => category.status === "ok" && category.hits.length > 0)
    .map((category) => ({ category, top: Math.max(...category.hits.map((hit) => hit.score)) }))
    .sort((left, right) => right.top - left.top)
    .slice(0, 3)
    .map(({ category }) => ({
      id: category.id,
      partnerType: PARTNER_TYPE[category.id],
      hits: category.hits,
      line: `${seedName}'s audience also leans toward ${cite(category.hits)}. Open to a partnership?`,
    }));
}

export function graphStatus(graph: GraphCategory[]): GraphStatus {
  if (graph.some((category) => category.status === "ok" && category.hits.length > 0)) return "scored";
  const failed = graph.some((category) => category.status === "unavailable");
  const answered = graph.some((category) => category.status === "empty" || category.status === "ok");
  if (failed && answered) return "partial";
  if (failed) return "unavailable";
  return "empty";
}

export function uncheckedCategories(graph: GraphCategory[]): UncheckedCategory[] {
  return graph
    .filter((category) => category.status === "unavailable")
    .map((category) => ({
      id: category.id,
      label: category.label,
      line: `${category.plural} couldn't be checked this time.`,
    }));
}

export async function resolveKinship(
  input: unknown,
  deps: { key: () => Promise<string | undefined>; get: QlooGetter },
): Promise<ResolveResult> {
  const parsed = readRequest(input);
  if (!parsed.ok) return { status: "bad-seed", reason: parsed.reason };
  const key = await deps.key();
  if (!key) return { status: "missing-key", seed: parsed.seed };
  const found = await searchEntity(deps.get, key, parsed.seed, parsed.entityId);
  if (found.status === "refused") return { status: "refused", seed: parsed.seed };
  if (found.status === "unavailable") return { status: "unavailable", seed: parsed.seed, unchecked: [] };
  if (found.status === "none") return { status: "no-match", seed: parsed.seed };
  if (found.status === "choose") return { status: "ambiguous", seed: parsed.seed, candidates: found.candidates };
  const graph = await loadTasteGraph(deps.get, key, found.entity.entityId, 20, 3, found.tags);
  if (graph === "refused") return { status: "refused", seed: parsed.seed };
  const unchecked = uncheckedCategories(graph);
  const status = graphStatus(graph);
  if (status === "unavailable") return { status: "unavailable", seed: parsed.seed, entity: found.entity, unchecked };
  return {
    status: "matched",
    seed: parsed.seed,
    entity: found.entity,
    pitches: buildPitches(found.entity.name, graph),
    graphStatus: status,
    unchecked,
  };
}

function cite(hits: GraphHit[]): string {
  const parts = hits.map((hit) => `${hit.name} (${formatAffinity(hit.score)})`);
  if (parts.length <= 1) return parts[0] ?? "";
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

function asCandidate(item: unknown): Candidate | null {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  const name = typeof record.name === "string" ? record.name.trim() : "";
  const entityId = typeof record.entity_id === "string" ? record.entity_id.trim() : "";
  const types = Array.isArray(record.types) ? record.types.filter((type): type is string => typeof type === "string") : [];
  const type = types.find((value): value is (typeof SEARCH_TYPES)[number] => value in TYPE_LABEL);
  if (!name || !entityId || !type) return null;
  const detail = detailFrom(record.disambiguation, name);
  return detail
    ? { name, entityId, typeLabel: TYPE_LABEL[type], detail }
    : { name, entityId, typeLabel: TYPE_LABEL[type] };
}

function detailFrom(value: unknown, name: string): string | undefined {
  if (typeof value !== "string") return undefined;
  const detail = value.trim().replace(/\s+/g, " ");
  if (!detail || normalizeName(detail) === normalizeName(name)) return undefined;
  return detail.length > 80 ? `${detail.slice(0, 77)}...` : detail;
}

function isEnglishLanguage(language: string): boolean {
  const code = language.trim().toLowerCase().replace(/-/g, "_");
  return code === "en" || code.startsWith("en_");
}

function englishAlias(item: unknown, needle: string): string | undefined {
  if (!item || typeof item !== "object") return undefined;
  const properties = (item as { properties?: unknown }).properties;
  if (!properties || typeof properties !== "object") return undefined;
  const akas = (properties as { akas?: unknown }).akas;
  if (!Array.isArray(akas)) return undefined;
  for (const aka of akas) {
    if (!aka || typeof aka !== "object") continue;
    const language = (aka as { language?: unknown }).language;
    const value = (aka as { value?: unknown }).value;
    if (typeof language !== "string" || typeof value !== "string" || !isEnglishLanguage(language)) continue;
    const alias = value.trim().replace(/\s+/g, " ");
    if (alias && normalizeName(alias) === needle) return alias;
  }
  return undefined;
}

function searchResults(body: unknown): unknown[] {
  if (!body || typeof body !== "object" || !Array.isArray((body as { results?: unknown }).results)) return [];
  return (body as { results: unknown[] }).results;
}

function aliasValues(properties: unknown): string[] {
  if (!properties || typeof properties !== "object") return [];
  const values: string[] = [];
  for (const key of ["akas", "aliases"] as const) {
    const list = (properties as Record<string, unknown>)[key];
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      if (!item || typeof item !== "object") continue;
      const value = (item as { value?: unknown }).value;
      if (typeof value === "string" && value.trim()) values.push(value.trim());
    }
  }
  return values;
}

function tagNames(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  return tags.flatMap((tag) => {
    if (!tag || typeof tag !== "object") return [];
    const name = (tag as { name?: unknown }).name;
    const type = (tag as { type?: unknown }).type;
    if (typeof name !== "string" || !name.trim()) return [];
    if (typeof type === "string" && type && !/:(keyword|genre|style|brand|category|media|music)/i.test(type)) return [];
    if (GENERIC_TAGS.has(name.trim().toLowerCase())) return [];
    return [name.trim()];
  });
}

function tagsFor(results: unknown[], entityId: string): string[] {
  for (const item of results) {
    if (!item || typeof item !== "object") continue;
    if ((item as { entity_id?: unknown }).entity_id !== entityId) continue;
    return tagNames((item as { tags?: unknown }).tags);
  }
  return [];
}

function insightEntities(body: unknown): unknown[] {
  if (!body || typeof body !== "object") return [];
  const results = (body as { results?: { entities?: unknown } }).results;
  return results && Array.isArray(results.entities) ? results.entities : [];
}

export async function searchEntity(
  get: QlooGetter,
  key: string,
  seed: string,
  entityId?: string,
): Promise<
  | { status: "use"; entity: Candidate; tags: string[] }
  | { status: "choose"; candidates: Candidate[] }
  | { status: "none" }
  | { status: "refused" }
  | { status: "unavailable" }
> {
  const searched = await get(key, "/search", searchParams(seed));
  if (!searched.ok) {
    if (searched.status === 401) return { status: "refused" };
    return { status: "unavailable" };
  }
  const results = searchResults(searched.body);
  const plan = resolutionPlan(exactCandidates(results, seed), entityId);
  if (plan.action === "none") return { status: "none" };
  if (plan.action === "choose") return { status: "choose", candidates: plan.candidates };
  return { status: "use", entity: plan.entity, tags: tagsFor(results, plan.entity.entityId) };
}

export async function loadTasteGraph(
  get: QlooGetter,
  key: string,
  seedId: string,
  take = 5,
  limit = 3,
  seedTags: readonly string[] = [],
): Promise<GraphCategory[] | "refused"> {
  const categories = await Promise.all(
    GRAPH.map((category) => categoryInsights(get, key, seedId, category, take, limit, seedTags)),
  );
  if (categories.every((category) => category === "auth")) return "refused";
  return categories.map((category, index) =>
    category === "auth"
      ? { id: GRAPH[index].id, label: GRAPH[index].label, plural: GRAPH[index].plural, status: "unavailable", hits: [] }
      : category,
  );
}

async function categoryInsights(
  get: QlooGetter,
  key: string,
  seedId: string,
  category: (typeof GRAPH)[number],
  take: number,
  limit: number,
  seedTags: readonly string[],
): Promise<GraphCategory | "auth"> {
  const params = new URLSearchParams();
  params.set("filter.type", category.filter);
  params.set("signal.interests.entities", seedId);
  params.set("take", String(take));
  const result = await get(key, "/v2/insights", params);
  if (!result.ok) {
    if (result.status === 401) return "auth";
    return { id: category.id, label: category.label, plural: category.plural, status: "unavailable", hits: [] };
  }
  const hits = insightEntities(result.body)
    .map((item) => asHit(item, seedId, seedTags))
    .filter((hit): hit is GraphHit => hit !== null)
    .slice(0, limit);
  return { id: category.id, label: category.label, plural: category.plural, status: hits.length ? "ok" : "empty", hits };
}
