import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SEARCH_TYPES,
  asHit,
  buildPitches,
  copyFailureMessage,
  exactCandidates,
  graphStatus,
  isLatestRequest,
  normalizeName,
  readRequest,
  resolveKinship,
  resolutionPlan,
  searchParams,
  uncheckedCategories,
  type GraphCategory,
  type QlooGetter,
} from "./kinship-resolve.ts";

const ARTIST = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const FILM = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const BRAND = "cccccccc-cccc-cccc-cccc-cccccccccccc";

function entity(name: string, entityId: string, type: string, disambiguation = "") {
  return { name, entity_id: entityId, types: [type], disambiguation };
}

function hit(name: string, entityId: string, affinity: unknown) {
  return { name, entity_id: entityId, query: { affinity } };
}

function category(id: GraphCategory["id"], status: GraphCategory["status"], hits: GraphCategory["hits"] = []): GraphCategory {
  const plural = { brand: "Brands", place: "Places", destination: "Destinations", artist: "Artists" }[id];
  const label = plural.slice(0, -1);
  return { id, label, plural, status, hits };
}

function scored(name: string, entityId: string, score: number) {
  return { name, entityId, score };
}

describe("normalizeName", () => {
  it("trims, collapses internal whitespace, and ignores case", () => {
    assert.equal(normalizeName("  Radio   Head "), "radio head");
    assert.equal(normalizeName("Radiohead"), normalizeName(" radiohead "));
  });
});

describe("exactCandidates", () => {
  it("resolves one exact match and keeps its type", () => {
    const candidates = exactCandidates(
      [entity("Radiohead: The King of Limbs", "film-1", "urn:entity:movie"), entity("Radiohead", ARTIST, "urn:entity:artist")],
      "Radiohead",
    );
    assert.deepEqual(candidates.map((candidate) => candidate.entityId), [ARTIST]);
    assert.equal(candidates[0].typeLabel, "Artist");
  });

  it("matches case-insensitively", () => {
    const candidates = exactCandidates([entity("Radiohead", ARTIST, "urn:entity:artist")], "radiohead");
    assert.equal(candidates.length, 1);
  });

  it("treats collapsed whitespace as the same name", () => {
    const candidates = exactCandidates([entity("Radio  head", ARTIST, "urn:entity:artist")], " radio head ");
    assert.equal(candidates.length, 1);
  });

  it("does not treat an approximate result as a match", () => {
    const candidates = exactCandidates(
      [entity("Spider-Man: No Way Home", FILM, "urn:entity:movie"), entity("No Doubt", ARTIST, "urn:entity:artist")],
      "zzzz-kinship-no-such-entity",
    );
    assert.deepEqual(candidates, []);
  });

  it("keeps every distinct exact-name entity and a useful detail", () => {
    const candidates = exactCandidates(
      [
        entity("Prince", ARTIST, "urn:entity:artist", "Prince"),
        entity("Prince", FILM, "urn:entity:movie", "2015"),
        entity("Prince", FILM, "urn:entity:movie", "2015"),
      ],
      "Prince",
    );
    assert.deepEqual(
      candidates.map((candidate) => [candidate.entityId, candidate.typeLabel, candidate.detail]),
      [
        [ARTIST, "Artist", undefined],
        [FILM, "Film", "2015"],
      ],
    );
  });

  it("drops duplicate ids and types outside artist, film, and brand", () => {
    const candidates = exactCandidates(
      [
        entity("Prince", ARTIST, "urn:entity:artist"),
        entity("Prince", ARTIST, "urn:entity:artist"),
        entity("Prince", "tv-1", "urn:entity:tv_show"),
      ],
      "Prince",
    );
    assert.deepEqual(candidates.map((candidate) => candidate.entityId), [ARTIST]);
  });
});

describe("search types", () => {
  it("asks only for artist, film, and brand", () => {
    assert.deepEqual(searchParams("Prince").getAll("types"), [...SEARCH_TYPES]);
    assert.equal(searchParams("Prince").get("take"), "100");
    assert.equal(searchParams("Prince").getAll("types").includes("urn:entity:tv_show"), false);
  });
});

describe("resolutionPlan", () => {
  it("uses the only exact match and asks when several remain", () => {
    const one = exactCandidates([entity("Radiohead", ARTIST, "urn:entity:artist")], "Radiohead");
    const many = exactCandidates(
      [entity("Prince", ARTIST, "urn:entity:artist"), entity("Prince", FILM, "urn:entity:movie", "2015")],
      "Prince",
    );
    assert.equal(resolutionPlan(one).action, "use");
    assert.equal(resolutionPlan(many).action, "choose");
    const chosen = resolutionPlan(many, FILM);
    assert.equal(chosen.action, "use");
    if (chosen.action === "use") assert.equal(chosen.entity.entityId, FILM);
  });
});

describe("resolveKinship", () => {
  it("resolves the only exact match when it sits past the first 20 results", async () => {
    const filler = Array.from({ length: 74 }, (_, index) => entity(`Near ${index}`, `near-${index}`, "urn:entity:movie"));
    const results = [...filler, entity("Radiohead", ARTIST, "urn:entity:artist"), entity("Radiohead tribute", "other", "urn:entity:artist")];
    assert.equal(results.length, 76);
    assert.equal(normalizeName(results[74].name), "radiohead");
    const calls: string[] = [];
    const get: QlooGetter = async (_key, path, params) => {
      calls.push(path);
      assert.equal(params.get("take"), path === "/search" ? "100" : "5");
      if (path === "/search") return { ok: true, body: { results } };
      return { ok: true, body: { results: { entities: [hit("Patagonia", BRAND, 0.91)] } } };
    };
    const result = await resolveKinship({ seed: "Radiohead" }, { key: async () => "test-key", get });
    assert.equal(result.status, "matched");
    if (result.status !== "matched") return;
    assert.equal(result.entity.entityId, ARTIST);
    assert.equal(result.entity.typeLabel, "Artist");
    assert.equal(calls.filter((path) => path === "/v2/insights").length, 4);
    const serialized = JSON.stringify(result);
    assert.equal(serialized.includes("Near 0"), false);
    assert.equal(serialized.includes("test-key"), false);
  });

  it("does not call insights or build pitches when nothing matches exactly", async () => {
    const calls: string[] = [];
    const get: QlooGetter = async (_key, path) => {
      calls.push(path);
      return { ok: true, body: { results: [entity("Spider-Man: No Way Home", FILM, "urn:entity:movie")] } };
    };
    const result = await resolveKinship({ seed: "zzzz-kinship-no-such-entity" }, { key: async () => "test-key", get });
    assert.equal(result.status, "no-match");
    assert.deepEqual(calls, ["/search"]);
    assert.equal(JSON.stringify(result).includes("test-key"), false);
  });

  it("returns a selection state and does not call insights until one entity is chosen", async () => {
    const calls: string[] = [];
    const get: QlooGetter = async (_key, path, params) => {
      calls.push(`${path}?${params.get("signal.interests.entities") ?? ""}`);
      if (path === "/search") {
        return {
          ok: true,
          body: {
            results: [entity("Prince", ARTIST, "urn:entity:artist", "Prince"), entity("Prince", FILM, "urn:entity:movie", "2015")],
          },
        };
      }
      return { ok: true, body: { results: { entities: [hit("Patagonia", BRAND, 0.98)] } } };
    };
    const first = await resolveKinship({ seed: "Prince" }, { key: async () => "test-key", get });
    assert.equal(first.status, "ambiguous");
    assert.equal(calls.some((call) => call.startsWith("/v2/insights")), false);
    const second = await resolveKinship({ seed: "Prince", entityId: FILM }, { key: async () => "test-key", get });
    assert.equal(second.status, "matched");
    if (second.status === "matched") {
      assert.equal(second.entity.entityId, FILM);
      assert.equal(second.entity.typeLabel, "Film");
    }
    assert.equal(calls.some((call) => call === `/v2/insights?${FILM}`), true);
    assert.equal(calls.some((call) => call === `/v2/insights?${ARTIST}`), false);
  });

  it("ranks by the strongest score and keeps at most three pitches", () => {
    const graph = [
      category("destination", "ok", [scored("Lisbon", "d", 0.4)]),
      category("place", "ok", [scored("Room", "p", 0.7)]),
      category("artist", "ok", [scored("Thom", "a", 0.8)]),
      category("brand", "ok", [scored("Patagonia", "b", 0.99), scored("Arc'teryx", "c", 0.5)]),
    ];
    const pitches = buildPitches("Radiohead", graph);
    assert.deepEqual(pitches.map((pitch) => pitch.id), ["brand", "artist", "place"]);
    assert.equal(pitches.length <= 3, true);
    assert.equal(pitches[0].line.includes("Patagonia (0.99)"), true);
    assert.equal(pitches[0].line.includes("Arc'teryx (0.50)"), true);
    assert.equal(pitches[0].hits[0].score.toFixed(2), "0.99");
  });

  it("keeps valid pitches and names only the category that failed", async () => {
    const get: QlooGetter = async (_key, path, params) => {
      if (path === "/search") return { ok: true, body: { results: [entity("Radiohead", ARTIST, "urn:entity:artist")] } };
      const type = params.get("filter.type");
      if (type === "urn:entity:place") return { ok: false, status: 503 };
      if (type === "urn:entity:destination") return { ok: true, body: { results: { entities: [hit("Nowhere", "n", "0.9")] } } };
      return { ok: true, body: { results: { entities: [hit(type === "urn:entity:brand" ? "Patagonia" : "Thom", "h", 0.91)] } } };
    };
    const result = await resolveKinship({ seed: "Radiohead" }, { key: async () => "test-key", get });
    assert.equal(result.status, "matched");
    if (result.status !== "matched") return;
    assert.deepEqual(result.unchecked.map((category) => category.line), ["Places couldn't be checked this time."]);
    assert.equal(result.pitches.some((pitch) => pitch.id === "place"), false);
    assert.equal(result.pitches.some((pitch) => pitch.id === "destination"), false);
    assert.equal(result.graphStatus, "scored");
  });

  it("does not call an empty category a failure", () => {
    const graph = [category("brand", "ok", [scored("Patagonia", "b", 0.9)]), category("place", "empty"), category("destination", "empty"), category("artist", "empty")];
    assert.deepEqual(uncheckedCategories(graph), []);
    assert.equal(graphStatus(graph), "scored");
  });

  it("names a failed category when the others answered with no score", () => {
    const graph = [category("brand", "empty"), category("place", "unavailable"), category("destination", "empty"), category("artist", "empty")];
    assert.equal(graphStatus(graph), "partial");
    assert.deepEqual(uncheckedCategories(graph).map((item) => item.line), ["Places couldn't be checked this time."]);
    assert.equal(buildPitches("Radiohead", graph).length, 0);
  });

  it("uses an error state when every category fails", async () => {
    const get: QlooGetter = async (_key, path) => {
      if (path === "/search") return { ok: true, body: { results: [entity("Radiohead", ARTIST, "urn:entity:artist")] } };
      return { ok: false, status: 503 };
    };
    const result = await resolveKinship({ seed: "Radiohead" }, { key: async () => "test-key", get });
    assert.equal(result.status, "unavailable");
    if (result.status === "unavailable") assert.equal(result.unchecked.length, 4);
  });

  it("treats a search 401 as a bad key and a category 403 as unchecked", async () => {
    const refused: QlooGetter = async () => ({ ok: false, status: 401 });
    const auth = await resolveKinship({ seed: "Radiohead" }, { key: async () => "test-key", get: refused });
    assert.equal(auth.status, "refused");

    const mixed: QlooGetter = async (_key, path, params) => {
      if (path === "/search") return { ok: true, body: { results: [entity("Radiohead", ARTIST, "urn:entity:artist")] } };
      if (params.get("filter.type") === "urn:entity:place") return { ok: false, status: 403 };
      return { ok: true, body: { results: { entities: [hit("Patagonia", BRAND, 0.8)] } } };
    };
    const result = await resolveKinship({ seed: "Radiohead" }, { key: async () => "test-key", get: mixed });
    assert.equal(result.status, "matched");
    if (result.status === "matched") assert.equal(result.unchecked[0]?.line, "Places couldn't be checked this time.");
  });

  it("does not pitch a missing score or the seed itself", () => {
    assert.equal(asHit(hit("Patagonia", BRAND, "0.98"), ARTIST), null);
    assert.equal(asHit(hit("Radiohead", ARTIST, 0.99), ARTIST), null);
    assert.equal(asHit({ name: "Patagonia", entity_id: BRAND }, ARTIST), null);
  });
});

describe("input and reliability", () => {
  it("rejects a missing seed, a non-string seed, and a seed past 120 characters", () => {
    assert.equal(readRequest(null).ok, false);
    assert.equal(readRequest({ seed: 12 }).ok, false);
    assert.equal(readRequest({ seed: "   " }).ok, false);
    const tooLong = readRequest({ seed: "a".repeat(121) });
    assert.equal(tooLong.ok, false);
    if (!tooLong.ok) assert.equal(tooLong.reason, "too-long");
    assert.equal(readRequest({ seed: "Radiohead" }).ok, true);
  });

  it("ignores an older request", () => {
    assert.equal(isLatestRequest(1, 2), false);
    assert.equal(isLatestRequest(2, 2), true);
  });

  it("does not claim a failed copy can be selected", () => {
    assert.equal(copyFailureMessage(), "Couldn't copy");
    assert.equal(copyFailureMessage().toLowerCase().includes("select"), false);
  });
});
