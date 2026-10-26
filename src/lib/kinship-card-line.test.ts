import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { acceptAgentCardLine, cardLine, isCardSafe, pageCardLines, stockPhrases } from "./kinship-card-line.ts";

const hits = (names: string[], score = 0.7) => names.map((name, i) => ({ name, score: score - i * 0.01 }));

describe("card line variety", () => {
  it("never repeats a 3-word stock phrase across the cards on one page", () => {
    const pitches = [
      { partnerType: "Brand partner", hits: hits(["Patagonia", "Arc'teryx", "Salomon", "Nike ACG", "Columbia"], 0.9) },
      { partnerType: "Artist partner", hits: hits(["Thom Yorke", "Jonny Greenwood", "Radiohead Ensemble"], 0.7) },
      { partnerType: "Place partner", hits: hits(["Room 1", "Rough Trade", "Ronnie Scott's", "Koko"], 0.5) },
    ];
    const names = pitches.flatMap((pitch) => pitch.hits.map((hit) => hit.name));
    const lines = pageCardLines("Radiohead", pitches).flat();
    const seen = new Map<string, number>();
    for (const line of lines) {
      const own = names.filter((name) => line.includes(name));
      for (const gram of new Set(stockPhrases(line, ["Radiohead", ...own]))) seen.set(gram, (seen.get(gram) ?? 0) + 1);
    }
    const repeats = [...seen].filter(([, count]) => count > 1).map(([gram]) => gram);
    assert.deepEqual(repeats, []);
  });

  it("names only its own partner, never another card's", () => {
    const pitches = [
      { partnerType: "Brand partner", hits: hits(["Patagonia"], 0.95) },
      { partnerType: "Brand partner", hits: hits(["Salomon"], 0.4) },
    ];
    const [first, second] = pageCardLines("Radiohead", pitches);
    assert.equal(first[0].includes("Salomon"), false);
    assert.equal(second[0].includes("Patagonia"), false);
  });

  it("never uses the dev phrase or a score in a card line", () => {
    for (const score of [0.95, 0.7, 0.2]) {
      const line = cardLine("Nike", { name: "adidas", score }, "Brand partner");
      assert.equal(/qloo|in data|\d/i.test(line), false, line);
      assert.equal(isCardSafe(line), true);
    }
  });

  it("drops an agent line that repeats a phrase already on the page or names another partner", () => {
    const taken = new Set(stockPhrases("Most of Nike's fans also show up for adidas.", ["Nike", "adidas"]));
    assert.equal(acceptAgentCardLine("Most of Nike's fans also show up for Puma.", "Nike", "Puma", taken), null);
    assert.equal(isCardSafe("Matches the Qloo data for Puma."), false);
  });
});
