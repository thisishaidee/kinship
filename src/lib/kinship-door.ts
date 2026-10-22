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
  .handler(async ({ data }) => compareKinship(data, { key: qlooKey, get: qlooGet, explain: explainWithXai }));

async function explainWithXai(evidence: CompareEvidence): Promise<string | null> {
  const { env } = await import("@/lib/env.server");
  const key = env("XAI_API_KEY");
  if (!key) return null;
  try {
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "grok-4.20-0309-non-reasoning",
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              "You explain a pairing using only the JSON in the user message. Write exactly two sentences. Cite affinity scores exactly as the three-decimal strings in the JSON. Name only entities present in the JSON. Do not claim a partnership exists, is available, or will succeed. Do not add causes, history, genres, or locations that are not fields in the JSON. If overlaps is empty, say there is no shared entity in these results and do not guess why the audiences might fit.",
          },
          { role: "user", content: JSON.stringify(evidence) },
        ],
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
    const text = body.choices?.[0]?.message?.content;
    return typeof text === "string" ? text : null;
  } catch {
    return null;
  }
}
