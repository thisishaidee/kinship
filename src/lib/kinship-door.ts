import { createServerFn } from "@tanstack/react-start";

const SEARCH_TYPES = ["urn:entity:artist", "urn:entity:movie", "urn:entity:brand"] as const;

const TYPE_LABEL: Record<string, string> = {
  "urn:entity:artist": "Artist",
  "urn:entity:movie": "Film",
  "urn:entity:brand": "Brand",
};

const GRAPH = [
  { id: "brand", label: "Brand", filter: "urn:entity:brand" },
  { id: "place", label: "Place", filter: "urn:entity:place" },
  { id: "destination", label: "Destination", filter: "urn:entity:destination" },
  { id: "artist", label: "Artist", filter: "urn:entity:artist" },
] as const;

export type ResolvedEntity = {
  name: string;
  typeLabel: string;
  entityId: string;
};

export type GraphHit = {
  name: string;
  score: number;
  entityId: string;
};

export type GraphCategory = {
  id: (typeof GRAPH)[number]["id"];
  label: string;
  status: "ok" | "empty" | "unavailable";
  hits: GraphHit[];
};

export type Pitch = {
  id: (typeof GRAPH)[number]["id"];
  partnerType: string;
  hits: GraphHit[];
  line: string;
};

export type GraphStatus = "scored" | "empty" | "unavailable";

export type ResolveResult =
  | { status: "matched"; seed: string; entity: ResolvedEntity; pitches: Pitch[]; graphStatus: GraphStatus }
  | { status: "no-match"; seed: string }
  | { status: "missing-key"; seed: string }
  | { status: "refused"; seed: string }
  | { status: "unavailable"; seed: string }
  | { status: "bad-seed" };

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

async function qlooGet(key: string, path: string, params: URLSearchParams): Promise<{ ok: true; body: unknown } | { ok: false; status: number }> {
  try {
    const response = await fetch(`https://hackathon.api.qloo.com${path}?${params}`, {
      headers: { "X-Api-Key": key },
      signal: AbortSignal.timeout(12000),
    });
    if (response.status === 401 || response.status === 403) return { ok: false, status: response.status };
    if (!response.ok) return { ok: false, status: response.status };
    return { ok: true, body: await response.json() };
  } catch {
    return { ok: false, status: 0 };
  }
}

function asEntity(item: unknown): ResolvedEntity | null {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  const name = typeof record.name === "string" ? record.name.trim() : "";
  const entityId = typeof record.entity_id === "string" ? record.entity_id.trim() : "";
  const types = Array.isArray(record.types) ? record.types.filter((type) => typeof type === "string") : [];
  const type = types.find((value) => value in TYPE_LABEL) ?? types[0];
  if (!name || !entityId || typeof type !== "string") return null;
  return { name, entityId, typeLabel: TYPE_LABEL[type] ?? "Entity" };
}

function chooseEntity(results: unknown[], seed: string): ResolvedEntity | null {
  const entities = results.map(asEntity).filter((entity): entity is ResolvedEntity => entity !== null);
  const needle = seed.toLowerCase();
  return entities.find((entity) => entity.name.toLowerCase() === needle) ?? entities[0] ?? null;
}

function asHit(item: unknown, seedId: string): GraphHit | null {
  if (!item || typeof item !== "object") return null;
  const record = item as Record<string, unknown>;
  const name = typeof record.name === "string" ? record.name.trim() : "";
  const entityId = typeof record.entity_id === "string" ? record.entity_id.trim() : "";
  const query = record.query;
  const affinity = query && typeof query === "object" ? (query as { affinity?: unknown }).affinity : undefined;
  if (!name || !entityId || entityId === seedId) return null;
  if (typeof affinity !== "number" || !Number.isFinite(affinity)) return null;
  return { name, entityId, score: affinity };
}

async function searchSeed(key: string, seed: string): Promise<ResolvedEntity | "no-match" | "refused" | "unavailable"> {
  const params = new URLSearchParams();
  params.set("query", seed);
  for (const type of SEARCH_TYPES) params.append("types", type);
  params.set("take", "5");
  const result = await qlooGet(key, "/search", params);
  if (!result.ok) return result.status === 401 || result.status === 403 ? "refused" : "unavailable";
  const results = result.body && typeof result.body === "object" && Array.isArray((result.body as { results?: unknown }).results)
    ? (result.body as { results: unknown[] }).results
    : [];
  return chooseEntity(results, seed) ?? "no-match";
}

async function categoryInsights(key: string, seedId: string, category: (typeof GRAPH)[number]): Promise<GraphCategory | "refused"> {
  const params = new URLSearchParams();
  params.set("filter.type", category.filter);
  params.set("signal.interests.entities", seedId);
  params.set("take", "5");
  const result = await qlooGet(key, "/v2/insights", params);
  if (!result.ok) {
    if (result.status === 401 || result.status === 403) return "refused";
    return { id: category.id, label: category.label, status: "unavailable", hits: [] };
  }
  const results = result.body && typeof result.body === "object" ? (result.body as { results?: { entities?: unknown } }).results : undefined;
  const entities = results && Array.isArray(results.entities) ? results.entities : [];
  const hits = entities.map((item) => asHit(item, seedId)).filter((hit): hit is GraphHit => hit !== null).slice(0, 3);
  return { id: category.id, label: category.label, status: hits.length ? "ok" : "empty", hits };
}

const PARTNER_TYPE: Record<(typeof GRAPH)[number]["id"], string> = {
  brand: "Brand partner",
  place: "Place partner",
  destination: "Destination partner",
  artist: "Artist partner",
};

function cite(hits: GraphHit[]): string {
  const parts = hits.map((hit) => `${hit.name} (${hit.score.toFixed(2)})`);
  if (parts.length <= 1) return parts[0] ?? "";
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

function buildPitches(seedName: string, graph: GraphCategory[]): Pitch[] {
  return graph
    .filter((category) => category.status === "ok" && category.hits.length > 0)
    .map((category) => ({ category, top: Math.max(...category.hits.map((hit) => hit.score)) }))
    .sort((a, b) => b.top - a.top)
    .slice(0, 3)
    .map(({ category }) => ({
      id: category.id,
      partnerType: PARTNER_TYPE[category.id],
      hits: category.hits,
      line: `${seedName}'s audience also leans toward ${cite(category.hits)}. Open to a partnership?`,
    }));
}

function graphStatus(graph: GraphCategory[]): GraphStatus {
  if (graph.some((category) => category.status === "ok" && category.hits.length > 0)) return "scored";
  if (graph.some((category) => category.status === "unavailable")) return "unavailable";
  return "empty";
}

async function tasteGraph(key: string, seedId: string): Promise<GraphCategory[] | "refused"> {
  const categories = await Promise.all(GRAPH.map((category) => categoryInsights(key, seedId, category)));
  if (categories.every((category) => category === "refused")) return "refused";
  return categories.map((category, index) =>
    category === "refused"
      ? { id: GRAPH[index].id, label: GRAPH[index].label, status: "unavailable", hits: [] }
      : category,
  );
}

export const resolveKinshipSeed = createServerFn({ method: "POST" })
  .validator((input: { seed: string }) => ({ seed: input.seed }))
  .handler(async ({ data }): Promise<ResolveResult> => {
    const seed = data.seed.trim();
    if (!seed || seed.length > 120) return { status: "bad-seed" };
    const key = await qlooKey();
    if (!key) return { status: "missing-key", seed };
    const entity = await searchSeed(key, seed);
    if (entity === "no-match") return { status: "no-match", seed };
    if (entity === "refused") return { status: "refused", seed };
    if (entity === "unavailable") return { status: "unavailable", seed };
    const graph = await tasteGraph(key, entity.entityId);
    if (graph === "refused") return { status: "refused", seed };
    return { status: "matched", seed, entity, pitches: buildPitches(entity.name, graph), graphStatus: graphStatus(graph) };
  });
