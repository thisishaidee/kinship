import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  SEARCH_TYPES,
  asHit,
  buildPitches,
  cleanDisplayName,
  copyFailureMessage,
  exactCandidates,
  formatAffinity,
  graphStatus,
  isLatestRequest,
  normalizeName,
  partnerSearchHref,
  readRequest,
  relevantHit,
  resolveKinship,
  resolutionPlan,
  searchParams,
  sharesDomain,
  uncheckedCategories,
  type GraphCategory,
  type QlooGetter,
} from "./kinship-resolve.ts";

const ARTIST = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const FILM = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const BRAND = "cccccccc-cccc-cccc-cccc-cccccccccccc";

function entity(name: string, entityId: string, type: string, disambiguation = "") {
  return {
    name,
    entity_id: entityId,
    types: [type],
    disambiguation,
    properties: undefined as { akas?: { language: string; value: string }[] } | undefined,
  };
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

  it("accepts an exact English alias and keeps the canonical name", () => {
    const product = entity("Air Jordan Product Line", BRAND, "urn:entity:brand");
    product.properties = {
      akas: [
        { language: "es", value: "Jordan" },
        { language: "ru", value: "Jordan Brand" },
        { language: "fr", value: "Nike Air Jordan" },
        { language: "en-AU", value: "Air Jordan" },
        { language: "it", value: "Air Jordan" },
      ],
    };
    const royal = entity("Royal Jordanian", "royal", "urn:entity:brand");
    royal.properties = { akas: [{ language: "en", value: "Royal Jordanian Airlines" }] };
    const italianOnly = entity("Scarpa", "it-only", "urn:entity:brand");
    italianOnly.properties = { akas: [{ language: "it", value: "Air Jordan" }] };

    const air = exactCandidates([royal, italianOnly, product, entity("One Man and His Shoes", FILM, "urn:entity:movie")], "Air Jordan");
    assert.deepEqual(
      air.map((candidate) => [candidate.name, candidate.typeLabel, candidate.detail]),
      [["Air Jordan Product Line", "Brand", "Also called Air Jordan"]],
    );
    assert.equal(exactCandidates([product, royal], "Jordan Brand").length, 0);
    assert.equal(exactCandidates([italianOnly], "Air Jordan").length, 0);
  });

  it("keeps Jordan's exact artist and films and does not add Air Jordan through a non-English alias", () => {
    const product = entity("Air Jordan Product Line", BRAND, "urn:entity:brand");
    product.properties = {
      akas: [
        { language: "es", value: "Jordan" },
        { language: "bg", value: "jordan" },
        { language: "en_au", value: "Air Jordan" },
      ],
    };
    const candidates = exactCandidates(
      [
        product,
        entity("Jordan", ARTIST, "urn:entity:artist", "Jordan"),
        entity("Jordan Rudess", "rudess", "urn:entity:artist"),
        entity("Jordan", FILM, "urn:entity:movie", "2010"),
        entity("Jordan", "film-2022", "urn:entity:movie", "2022"),
      ],
      "Jordan",
    );
    assert.deepEqual(
      candidates.map((candidate) => [candidate.entityId, candidate.typeLabel, candidate.detail]),
      [
        [ARTIST, "Artist", undefined],
        [FILM, "Film", "2010"],
        ["film-2022", "Film", "2022"],
      ],
    );
    assert.equal(resolutionPlan(candidates).action, "choose");
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
      assert.equal(params.get("take"), path === "/search" ? "100" : "20");
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

  it("does not call insights while Jordan stays ambiguous, and uses the canonical brand for an English alias", async () => {
    const product = entity("Air Jordan Product Line", BRAND, "urn:entity:brand");
    product.properties = { akas: [{ language: "en_au", value: "Air Jordan" }, { language: "es", value: "Jordan" }] };
    const jordanResults = [
      product,
      entity("Jordan", ARTIST, "urn:entity:artist", "Jordan"),
      entity("Jordan", FILM, "urn:entity:movie", "2010"),
      entity("Jordan", "film-2022", "urn:entity:movie", "2022"),
    ];
    const calls: string[] = [];
    const get: QlooGetter = async (_key, path, params) => {
      calls.push(path);
      if (path === "/search") return { ok: true, body: { results: params.get("query") === "Air Jordan" ? [product] : jordanResults } };
      return { ok: true, body: { results: { entities: [hit("Patagonia", "place-1", 0.91)] } } };
    };
    const jordan = await resolveKinship({ seed: "Jordan" }, { key: async () => "test-key", get });
    assert.equal(jordan.status, "ambiguous");
    if (jordan.status === "ambiguous") {
      assert.deepEqual(jordan.candidates.map((candidate) => candidate.name), ["Jordan", "Jordan", "Jordan"]);
      assert.equal(jordan.candidates.some((candidate) => candidate.name === "Air Jordan Product Line"), false);
    }
    assert.equal(calls.includes("/v2/insights"), false);

    const air = await resolveKinship({ seed: "Air Jordan" }, { key: async () => "test-key", get });
    assert.equal(air.status, "matched");
    if (air.status === "matched") {
      assert.equal(air.entity.name, "Air Jordan Product Line");
      assert.equal(air.entity.typeLabel, "Brand");
      assert.equal(air.entity.entityId, BRAND);
    }
    assert.equal(calls.filter((path) => path === "/v2/insights").length, 4);
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
    assert.equal(pitches[0].line.includes("Patagonia (0.990)"), true);
    assert.equal(pitches[0].line.includes("Arc'teryx (0.500)"), true);
    assert.equal(formatAffinity(pitches[0].hits[0].score), "0.990");
    assert.equal(pitches[0].hits[0].score, 0.99);
  });

  it("shows three decimal places in the copied line and keeps the stronger category first", () => {
    const graph = [
      category("brand", "ok", [scored("Air Jordan Product Line", "b", 0.969972417154696)]),
      category("artist", "ok", [
        scored("Wiz Khalifa", "w", 0.9789124253791885),
        scored("Jay-Z", "j", 0.9766692852135209),
        scored("DJ Khaled", "d", 0.9764786784079703),
      ]),
    ];
    const pitches = buildPitches("Nike", graph);
    assert.deepEqual(pitches.map((pitch) => pitch.id), ["artist", "brand"]);
    assert.equal(pitches[0].line, "Nike's audience also leans toward Wiz Khalifa (0.979), Jay-Z (0.977), and DJ Khaled (0.976). Open to a partnership?");
    assert.equal(pitches[0].line.includes("(0.98)"), false);
    assert.equal(pitches[0].hits[0].score, 0.9789124253791885);
    assert.equal(formatAffinity(pitches[0].hits[0].score), "0.979");
    assert.equal(formatAffinity(pitches[0].hits[1].score), "0.977");
    assert.equal(formatAffinity(pitches[0].hits[2].score), "0.976");
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

  it("drops the jammed Drake&Orson name instead of showing a scrape", () => {
    assert.equal(
      asHit(
        { name: "Drake&Orson", entity_id: "drake", properties: { akas: [{ value: "Drake" }] }, query: { affinity: 0.971 } },
        "seed",
      ),
      null,
    );
    assert.equal(cleanDisplayName("Drake&Orson", ["Drake"]), null);
    assert.equal(cleanDisplayName("Drake & Future", []), "Drake & Future");
    assert.equal(cleanDisplayName("AT&T", []), "AT&T");
  });

  it("keeps screen brands for a film and drops Tesla, Apple, and random places", () => {
    const film = { seedKind: "movie" as const, category: "brand" as const };
    assert.equal(
      relevantHit("movie", "brand", ["sci fi", "film score"], [{ name: "Automotive", type: "urn:tag:industry:qloo" }, { name: "Car & SUV", type: "urn:tag:genre:brand" }], "Tesla"),
      false,
    );
    assert.equal(
      relevantHit("movie", "brand", ["sci fi"], [{ name: "Consumer Electronics", type: "urn:tag:industry:qloo" }, { name: "Phones & Tablets", type: "urn:tag:genre:brand" }], "Apple Inc"),
      false,
    );
    assert.equal(
      relevantHit(
        "movie",
        "brand",
        ["sci fi"],
        [
          { name: "Production Company", type: "urn:tag:genre:brand" },
          { name: "Gaming", type: "urn:tag:genre:brand" },
          { name: "Consumer Electronics", type: "urn:tag:industry:qloo" },
        ],
        "Sony",
      ),
      true,
    );
    assert.equal(relevantHit("movie", "place", ["sci fi"], [{ name: "Observation deck", type: "urn:tag:keyword:qloo" }], "Top of The Rock"), false);
    assert.equal(relevantHit("movie", "artist", ["cinematic"], [{ name: "Emotional Film Score", type: "urn:tag:style:qloo" }], "Hildur Guðnadóttir"), true);
    assert.equal(
      relevantHit("artist", "brand", ["alternative rock"], [{ name: "Fashion & Apparel", type: "urn:tag:industry:qloo" }], "Patagonia"),
      true,
    );
    assert.equal(relevantHit("brand", "artist", ["basketball"], [{ name: "Hip Hop", type: "urn:tag:genre" }], "Wiz Khalifa"), true);
    assert.equal(relevantHit("brand", "place", ["basketball"], [{ name: "Hotel", type: "urn:tag:keyword" }], "Seven Hotel"), false);
    assert.equal(film.category, "brand");
  });

  it("labels a film with its year and a short english line, most popular first", () => {
    const candidates = exactCandidates(
      [
        {
          name: "Dune",
          entity_id: "old",
          types: ["urn:entity:movie"],
          disambiguation: "1984",
          popularity: 0.4,
          properties: { release_year: 1984 },
        },
        {
          name: "Dune",
          entity_id: "new",
          types: ["urn:entity:movie"],
          disambiguation: "2021",
          popularity: 0.99,
          properties: {
            release_year: 2021,
            short_descriptions: [{ language: "en", value: "A noble house fights over a desert planet." }],
          },
        },
      ],
      "Dune",
    );
    assert.equal(candidates[0]?.entityId, "new");
    assert.equal(candidates[0]?.detail, "2021");
    assert.equal(candidates[0]?.typeLabel, "Film");
    assert.equal(candidates[0]?.blurb, "A noble house fights over a desert planet.");
    assert.equal(candidates[1]?.detail, "1984");
  });

  it("drops a brand that only shares a generic tag with a film", () => {
    const tesla = asHit(
      { name: "Tesla", entity_id: "tesla", tags: [{ name: "ambitious" }, { name: "Automotive" }], query: { affinity: 0.988 } },
      "dune",
      ["ambitious", "Cinematic", "Film score"],
    );
    const sony = asHit(
      { name: "Sony", entity_id: "sony", tags: [{ name: "Cinematography" }], query: { affinity: 0.921 } },
      "dune",
      ["Cinematic", "Cinematography"],
    );
    assert.equal(tesla, null);
    assert.equal(sony?.name, "Sony");
    assert.equal(sharesDomain([], ["Automotive"]), true);
    assert.equal(
      asHit(
        { name: "Top of The Rock", entity_id: "rock", tags: [{ name: "binoculars", type: "urn:tag:amenity:qloo" }], query: { affinity: 0.912 } },
        "dune",
        ["binoculars"],
      ),
      null,
    );
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

  it("builds a web search for the seed and partner without a profile URL", () => {
    const href = partnerSearchHref("Nike", "Wiz Khalifa");
    const parsed = new URL(href);
    assert.equal(parsed.origin + parsed.pathname, "https://www.google.com/search");
    assert.equal(parsed.searchParams.get("q"), "Nike Wiz Khalifa audience partnership");
    const encoded = partnerSearchHref('A & B', 'C "D"');
    assert.equal(new URL(encoded).searchParams.get("q"), 'A & B C "D" audience partnership');
    assert.equal(encoded.includes("javascript:"), false);
  });
});
