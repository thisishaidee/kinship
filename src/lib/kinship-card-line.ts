// Per-card one-liners for the single-search results page.
// Each line is built only from that card's own partner name, its partner type and its
// affinity tier. Lines rotate through several phrasings and are checked against the rest of
// the page, so no 3-word stock phrase repeats across cards. No numbers, no dashes, no "Qloo".

export type CardHit = { name: string; score: number };

type Template = (seed: string, name: string, noun: string) => string;

const TEMPLATES: Record<CardTier, Template[]> = {
  strong: [
    (seed, name, noun) => name + " is one of the closest cultural affinity results for " + seed + ".",
    (seed, name) => "The results place " + name + " near " + seed + " in its cultural affinity results.",
    (seed, name) => name + " appears among the strongest affinity signals returned for " + seed + ".",
    (seed, name) => "These results place " + name + " close to " + seed + ".",
    (seed, name, noun) => name + " is a leading " + noun + " signal in the results for " + seed + ".",
    (seed, name) => name + " stands out in the cultural results connected to " + seed + ".",
  ],
  mid: [
    (seed, name) => name + " is another cultural affinity result worth exploring alongside " + seed + ".",
    (seed, name) => "The results return " + name + " as a related cultural signal for " + seed + ".",
    (seed, name) => name + " has a clear place in the affinity results for " + seed + ".",
    (seed, name) => name + " is worth a closer look among the results for " + seed + ".",
    (seed, name) => "The results connect " + name + " with the cultural signals around " + seed + ".",
    (seed, name) => name + " appears as a related result for " + seed + ".",
  ],
  light: [
    (seed, name) => name + " appears as a lower-ranked cultural affinity result for " + seed + ".",
    (seed, name) => "A lighter affinity signal connects the results for " + seed + " and " + name + ".",
    (seed, name) => name + " is a more distant result in the cultural graph for " + seed + ".",
    (seed, name) => name + " appears further down the affinity results for " + seed + ".",
    (seed, name, noun) => name + " is a secondary " + noun + " result worth exploring alongside " + seed + ".",
    (seed, name) => "There is a smaller affinity signal between " + seed + " and " + name + " in these results.",
  ],
};
type CardTier = "strong" | "mid" | "light";

export function cardTier(score: number): CardTier {
  if (score >= 0.85) return "strong";
  if (score >= 0.6) return "mid";
  return "light";
}

// "Brand partner" -> "brand". Only the four partner types the graph returns.
export function partnerNoun(partnerType: string): string {
  return (partnerType.split(" ")[0] ?? "").toLowerCase() || "partner";
}

function nameHash(name: string): number {
  let total = 0;
  for (const char of name) total = (total * 31 + char.codePointAt(0)!) % 100003;
  return total;
}

// Lowercase 3-word runs with the seed and partner names replaced by a placeholder,
// so the same sentence shape counts as a repeat but the names themselves do not.
export function stockPhrases(text: string, names: string[]): string[] {
  let body = text;
  for (const name of names) {
    if (!name) continue;
    body = body.split(name).join(" x ");
    body = body.split(name.toLowerCase()).join(" x ");
  }
  const tokens = body.toLowerCase().replace(/’/g, "'").split(/[^a-z']+/).map((token) => token.replace(/'s$/, "")).filter(Boolean);
  const grams: string[] = [];
  for (let i = 0; i + 3 <= tokens.length; i++) grams.push(tokens.slice(i, i + 3).join(" "));
  return grams;
}

// Pick the first phrasing whose stock phrases are not already on the page, record them, and return it.
function pickUnused(templates: Template[], start: number, seed: string, name: string, noun: string, taken: Set<string>): string {
  for (let step = 0; step < templates.length; step++) {
    const text = templates[(start + step) % templates.length](seed, name, noun);
    const grams = stockPhrases(text, [seed, name]);
    if (grams.every((gram) => !taken.has(gram))) {
      for (const gram of grams) taken.add(gram);
      return text;
    }
  }
  // Every phrasing repeats something on the page: keep the rotation pick, it still reads correctly.
  const text = templates[start % templates.length](seed, name, noun);
  for (const gram of stockPhrases(text, [seed, name])) taken.add(gram);
  return text;
}

// One line per card for every pitch on the page, in card order. Shared `taken` set means no
// 3-word stock phrase repeats across cards, even across different partner sections.
// An agent line (first card of a pitch only) is used when it is safe and adds no repeated phrase.
export type PitchForLines = { partnerType: string; hits: CardHit[]; agentLine?: string | null };

export function pageCardLines(seed: string, pitches: PitchForLines[]): string[][] {
  const taken = new Set<string>();
  const allNames = pitches.flatMap((pitch) => pitch.hits.map((hit) => hit.name));
  return pitches.map((pitch) => {
    const noun = partnerNoun(pitch.partnerType);
    const top = pitch.hits[0];
    const agent = pitch.agentLine && top ? pitch.agentLine : null;
    const otherNames = allNames.filter((name) => name !== top?.name);
    const agentOk =
      agent !== null &&
      isCardSafe(agent) &&
      !otherNames.some((name) => name && agent.includes(name)) &&
      acceptAgentCardLine(agent, seed, top.name, taken) !== null;
    if (agentOk && agent) for (const gram of stockPhrases(agent, [seed, top.name])) taken.add(gram);
    return pitch.hits.map((hit, index) => {
      if (index === 0 && agentOk && agent) return agent;
      const templates = TEMPLATES[cardTier(hit.score)];
      const start = (index + nameHash(hit.name)) % templates.length;
      return pickUnused(templates, start, seed, hit.name, noun, taken);
    });
  });
}

// Single card, no page context (used as the fallback when no page-level line exists).
export function cardLine(seed: string, hit: CardHit, partnerType: string): string {
  return pageCardLines(seed, [{ partnerType, hits: [hit] }])[0][0];
}

// Agent-written card line: accept it only if it adds no stock phrase already used on the page.
// Returns the accepted line, or null so the caller keeps the template line.
export function acceptAgentCardLine(line: string, seed: string, name: string, taken: Set<string>): string | null {
  const grams = stockPhrases(line, [seed, name]);
  if (grams.some((gram) => taken.has(gram))) return null;
  return line;
}

// True when a line names Qloo or uses dev-speak; such lines never reach a card.
export function isCardSafe(line: string): boolean {
  return !/qloo|in data|taste graph|entity|fans? of|fan base|audience overlap|same crowd|same people|listeners? follow|show up for|reach the same|shared audience/i.test(line);
}
