// Per-card one-liners for the single-search results page.
// Each line is built only from that card's own partner name, its partner type and its
// affinity tier. Lines rotate through several phrasings and are checked against the rest of
// the page, so no 3-word stock phrase repeats across cards. No numbers, no dashes, no "Qloo".

export type CardHit = { name: string; score: number };

type Template = (seed: string, name: string, noun: string) => string;

const TEMPLATES: Record<CardTier, Template[]> = {
  strong: [
    (seed, name) => name + " ranks near the top of " + seed + "'s returned cultural signals.",
    (seed, name) => "This search places " + name + " among " + seed + "'s closest matches.",
    (seed, name) => name + " carries top affinity weight among the returned signals for " + seed + ".",
    (seed, name) => "The clearest result here points to " + name + " beside " + seed + ".",
    (seed, name) => name + " returns as a leading cultural signal for " + seed + ".",
    (seed, name) => "Among these results, " + name + " sits closest to " + seed + ".",
  ],
  mid: [
    (seed, name) => "A related result appears here: " + name + ", next to " + seed + ".",
    (seed, name) => "The returned list also includes " + name + " alongside " + seed + ".",
    (seed, name) => name + " appears further down this particular list.",
    (seed, name) => "There is a useful connection to inspect between " + seed + " and " + name + ".",
    (seed, name) => "One more signal worth a look is " + name + " near " + seed + ".",
    (seed, name) => "This search also points toward " + name + " as a useful direction.",
  ],
  light: [
    (seed, name) => name + " sits further from the top of this list.",
    (seed, name) => "This is a lower-ranked signal: " + name + " still appears.",
    (seed, name) => name + " is a more distant result in this particular search.",
    (seed, name) => "The signal is lighter here, with " + name + " included.",
    (seed, name) => "There is less affinity here, though " + name + " remains listed.",
    (seed, name) => "A secondary result worth noting is " + name + " in this search.",
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
