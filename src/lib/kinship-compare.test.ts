import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compareKinship, fallbackExplanation, groundedExplanation, sharedAffinities, type CompareEvidence } from "./kinship-compare.ts";
import { PAIRING_DISCLAIMER, PDF_FILENAME, buildPairingPdf, preparePdfAnchor } from "./kinship-pdf.ts";
import type { GraphCategory, QlooGetter } from "./kinship-resolve.ts";

const LEFT = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const RIGHT = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const SHARED = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const OTHER = "dddddddd-dddd-dddd-dddd-dddddddddddd";

function category(id: GraphCategory["id"], hits: GraphCategory["hits"]): GraphCategory {
  const plural = { brand: "Brands", place: "Places", destination: "Destinations", artist: "Artists" }[id];
  return { id, label: plural.slice(0, -1), plural, status: hits.length ? "ok" : "empty", hits };
}

function evidence(overlaps: CompareEvidence["overlaps"] = []): CompareEvidence {
  return { left: { name: "Nike", typeLabel: "Brand" }, right: { name: "Adidas", typeLabel: "Brand" }, overlaps };
}

describe("shared affinities", () => {
  it("keeps an entity only when the Qloo id matches and ranks by the weaker score", () => {
    const left = [category("artist", [{ name: "Rihanna", entityId: SHARED, score: 0.959357 }, { name: "Rio", entityId: "rio-a", score: 0.99 }])];
    const right = [
      category("artist", [{ name: "Rihanna", entityId: SHARED, score: 0.91 }, { name: "Rio de Janeiro", entityId: "rio-b", score: 0.98 }]),
      category("brand", [{ name: "Rihanna", entityId: OTHER, score: 0.99 }]),
    ];
    const overlaps = sharedAffinities(left, right);
    assert.deepEqual(overlaps.map((overlap) => overlap.entityId), [SHARED]);
    assert.equal(overlaps[0].leftScore, 0.959357);
    assert.equal(overlaps[0].rightScore, 0.91);
    assert.equal(overlaps[0].name, "Rihanna");
  });
});

describe("grounded explanation", () => {
  const sample = evidence([{ name: "Rihanna", category: "Artist", leftScore: "0.959", rightScore: "0.910" }]);

  it("accepts one sentence that cites only returned scores", () => {
    const result = groundedExplanation("Both pull toward Rihanna (0.959 / 0.910).", sample);
    assert.equal(result.source, "model");
  });

  it("accepts type and category words that are already in the evidence", () => {
    const result = groundedExplanation(
      "Both pull toward the Artist Wiz Khalifa (0.979 / 0.947).",
      evidence([{ name: "Wiz Khalifa", category: "Artist", leftScore: "0.979", rightScore: "0.947" }]),
    );
    assert.equal(result.source, "model");
  });

  it("rejects an invented name or score and uses the returned scores", () => {
    const invented = groundedExplanation("Both pull toward Drake (0.999 / 0.910).", sample);
    assert.equal(invented.source, "scores");
    assert.equal(invented.text, fallbackExplanation(sample));
    assert.equal(invented.text.includes("0.959"), true);
    assert.equal(invented.text.includes("Drake"), false);
  });

  it("never keeps a developer note about the model draft", () => {
    const leaked = groundedExplanation(
      "The model draft went outside the returned scores, so this line cites those scores directly. Nike and Adidas both connect to Rihanna at 0.959 and 0.910.",
      sample,
    );
    assert.equal(leaked.source, "scores");
    assert.equal(leaked.text.includes("model draft"), false);
    assert.equal(leaked.text.includes("0.959"), true);
  });

  it("does not invent a reason when nothing overlaps", () => {
    const text = fallbackExplanation(evidence());
    assert.equal(text.includes("no shared entity"), true);
    assert.equal(text.includes("invented"), false);
  });
});

describe("compareKinship", () => {
  it("does not call insights until both entities are selected", async () => {
    const calls: string[] = [];
    const get: QlooGetter = async (_key, path, params) => {
      calls.push(`${path}:${params.get("take") ?? ""}`);
      if (path === "/search") {
        const query = params.get("query");
        if (query === "Prince") {
          return {
            ok: true,
            body: {
              results: [
                { name: "Prince", entity_id: LEFT, types: ["urn:entity:artist"], disambiguation: "Prince" },
                { name: "Prince", entity_id: OTHER, types: ["urn:entity:movie"], disambiguation: "2015" },
              ],
            },
          };
        }
        return { ok: true, body: { results: [{ name: "Nike", entity_id: RIGHT, types: ["urn:entity:brand"], disambiguation: "" }] } };
      }
      return { ok: true, body: { results: { entities: [] } } };
    };
    const result = await compareKinship({ left: "Prince", right: "Nike" }, { key: async () => "test-key", get, explain: async () => null });
    assert.equal(result.status, "ambiguous");
    assert.equal(calls.some((call) => call.startsWith("/v2/insights")), false);
  });

  it("asks insights for 20 results and returns only the shared id", async () => {
    const takes: string[] = [];
    const get: QlooGetter = async (_key, path, params) => {
      if (path === "/search") {
        const id = params.get("query") === "Nike" ? LEFT : RIGHT;
        return { ok: true, body: { results: [{ name: params.get("query"), entity_id: id, types: ["urn:entity:brand"], disambiguation: "" }] } };
      }
      takes.push(params.get("take") ?? "");
      const seed = params.get("signal.interests.entities");
      const shared = { name: "Rihanna", entity_id: SHARED, query: { affinity: seed === LEFT ? 0.959357 : 0.91 } };
      const only = { name: seed === LEFT ? "Puma" : "Fila", entity_id: seed === LEFT ? "puma" : "fila", query: { affinity: 0.8 } };
      return { ok: true, body: { results: { entities: [shared, only] } } };
    };
    const result = await compareKinship(
      { left: "Nike", right: "Adidas" },
      {
        key: async () => "test-key",
        get,
        explain: async (evidence) => `Both pull toward Rihanna (${evidence.overlaps[0].leftScore} / ${evidence.overlaps[0].rightScore}).`,
      },
    );
    assert.equal(result.status, "matched");
    if (result.status !== "matched") return;
    assert.deepEqual(takes, ["20", "20", "20", "20", "20", "20", "20", "20"]);
    assert.deepEqual(result.overlaps.map((overlap) => overlap.entityId), [SHARED]);
    assert.equal(result.explanationSource, "model");
    assert.equal(result.explanation.includes("Puma"), false);
    assert.equal(JSON.stringify(result).includes("test-key"), false);
  });
});

describe("pairing pdf", () => {
  it("contains both entities, the shared score, the explanation, and the disclaimer", () => {
    const bytes = buildPairingPdf({
      leftName: "Nike",
      leftType: "Brand",
      rightName: "Adidas",
      rightType: "Brand",
      overlaps: [{ name: "Rihanna", category: "Artist", leftScore: "0.959", rightScore: "0.910" }],
      explanation: "Nike and Adidas both connect to Rihanna at 0.959 and 0.910. Those figures are the shared scores.",
    });
    const text = new TextDecoder().decode(bytes);
    assert.equal(text.includes("Nike"), true);
    assert.equal(text.includes("Adidas"), true);
    assert.equal(text.includes("Rihanna"), true);
    assert.equal(text.includes("0.959"), true);
    assert.equal(text.includes(PAIRING_DISCLAIMER), true);
    assert.equal(text.includes("%%EOF"), true);
  });

  it("keeps the file on the page for iPhone and downloads it elsewhere", () => {
    const iphone = { download: "", target: "" };
    preparePdfAnchor(iphone, "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", 5);
    assert.equal(iphone.download, PDF_FILENAME);
    assert.equal(iphone.target, "_blank");
    const desktop = { download: "", target: "_blank" };
    preparePdfAnchor(desktop, "Mozilla/5.0 Chrome", 0);
    assert.equal(desktop.target, "");
  });
});
