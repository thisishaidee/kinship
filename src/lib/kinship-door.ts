import { createServerFn } from "@tanstack/react-start";
import { compareKinship, type CompareEvidence } from "@/lib/kinship-compare";
import { resolveKinship, type QlooGetter } from "@/lib/kinship-resolve";

export type {
  Candidate,
  GraphHit,
  GraphStatus,
  Pitch,
  ResolveResult,
  ResolvedEntity,
  UncheckedCategory,
} from "@/lib/kinship-resolve";
export type { CompareEvidence, CompareResult, Overlap } from "@/lib/kinship-compare";
export { copyFailureMessage, formatAffinity, isLatestRequest, partnerSearchHref } from "@/lib/kinship-resolve";

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

const qlooGet: QlooGetter = async (key, path, params) => {
  try {
    const response = await fetch(`https://hackathon.api.qloo.com${path}?${params}`, {
      headers: { "X-Api-Key": key },
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) return { ok: false, status: response.status };
    return { ok: true, body: await response.json() };
  } catch {
    return { ok: false, status: 0 };
  }
};

export const resolveKinshipSeed = createServerFn({ method: "POST" })
  .validator((input: unknown) => input)
  .handler(async ({ data }) => resolveKinship(data, { key: qlooKey, get: qlooGet }));

export const compareKinshipSeeds = createServerFn({ method: "POST" })
  .validator((input: unknown) => input)
  .handler(async ({ data }) => compareKinship(data, { key: qlooKey, get: qlooGet, explain: explainWithGemini }));

const EXPLAIN_PROMPT =
  "You explain a pairing using only the JSON in the user message. Write exactly one sentence in this shape: Both pull toward NAME (LEFT / RIGHT) and NAME (LEFT / RIGHT). Use the top shared entities and their two scores from the JSON, without quotes, and do not use the words 'entity' or 'taste graph'. You may only name entities and facts present in the returned Qloo scores; if you cannot stay within them, say nothing and the fallback sentence will be used. Do not claim a partnership exists, is available, or will succeed. Do not add causes, history, genres, or locations that are not fields in the JSON. If overlaps is empty, say nothing.";

async function explainWithGemini(evidence: CompareEvidence): Promise<string | null> {
  const { env } = await import("@/lib/env.server");
  const key = env("GEMINI_API_KEY");
  if (!key) return null;
  try {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({ apiKey: key });
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: JSON.stringify(evidence),
      config: {
        systemInstruction: EXPLAIN_PROMPT,
        temperature: 0,
        maxOutputTokens: 256,
        thinkingConfig: { thinkingBudget: 0 },
        abortSignal: AbortSignal.timeout(20000),
      },
    });
    const text = response.text;
    return typeof text === "string" && text.trim() ? text : null;
  } catch {
    return null;
  }
}
