import type { AgentCall, AgentModel, AgentTools, PartnerCategory, ToolResult } from "@/lib/kinship-agent";
import { categoryInsights, graphCategory, searchCandidates, type QlooGetter, type SeedKind } from "@/lib/kinship-resolve";

// Server-only adapters. Gemini is the agent's brain (it sees tool results and decides the
// next call or the final sentence). Qloo is reached only through the injected getter,
// which is the single hackathon.api.qloo.com proxy in kinship-door. Keys never leave here.

const MODEL = "gemini-3.5-flash";

const SYSTEM = [
  "You are the research step of a partnership pitch tool.",
  "Use the tools to find the seed's strongest partner signals, then reply with one short sentence.",
  "Call find_entity only if you need another name. Call read_partners to read audience overlap for an entity you have seen.",
  "The final sentence may only name entities and numbers that appear in tool results. Do not claim a partnership exists.",
  "Reply with plain text, one sentence, when you are finished or when you are told no more calls are allowed.",
].join(" ");

const DECLARATIONS = [
  {
    name: "find_entity",
    description: "Search Qloo for an entity by name. Returns up to five candidates with entity_id.",
    parametersJsonSchema: {
      type: "object",
      properties: { query: { type: "string", description: "name to look up" } },
      required: ["query"],
    },
  },
  {
    name: "read_partners",
    description: "Read audience-overlap partners for a seen entity in one category. Returns hits with score.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        entity_id: { type: "string" },
        category: { type: "string", enum: ["brand", "place", "destination", "artist"] },
      },
      required: ["entity_id", "category"],
    },
  },
];

export function createGeminiModel(apiKey: string, seedName: string): AgentModel {
  let history: unknown[] = [];
  let started = false;
  return {
    async next(results, final) {
      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey });
      if (!started) {
        started = true;
        history = [{ role: "user", parts: [{ text: `Seed: ${seedName}. Start by reading partners.` }] }];
      } else if (results) {
        history.push({
          role: "user",
          parts: results.map((result) => ({
            functionResponse: { name: result.name, response: { ok: result.ok, data: result.data } },
          })),
        });
      }
      if (final) history.push({ role: "user", parts: [{ text: "No more tool calls. Write the one-sentence answer now." }] });
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: history as never,
        config: {
          systemInstruction: SYSTEM,
          temperature: 0,
          maxOutputTokens: 200,
          thinkingConfig: { thinkingBudget: 0 },
          abortSignal: AbortSignal.timeout(20000),
          tools: final ? undefined : [{ functionDeclarations: DECLARATIONS as never }],
        },
      });
      const calls = (response.functionCalls ?? []) as { name?: string; args?: Record<string, unknown> }[];
      const parts = calls.map((call) => ({ functionCall: { name: call.name, args: call.args ?? {} } }));
      if (calls.length > 0 && !final) {
        history.push({ role: "model", parts });
        const parsed: AgentCall[] = [];
        for (const call of calls) {
          if (call.name === "find_entity") parsed.push({ name: "find_entity", args: { query: String(call.args?.query ?? "") } });
          if (call.name === "read_partners") {
            parsed.push({
              name: "read_partners",
              args: { entity_id: String(call.args?.entity_id ?? ""), category: String(call.args?.category ?? "") as PartnerCategory },
            });
          }
        }
        return { kind: "calls", calls: parsed };
      }
      const text = response.text;
      if (typeof text !== "string") throw new Error("no text");
      return { kind: "final", text };
    },
  };
}

export function createQlooTools(
  key: string,
  get: QlooGetter,
  seedTags: readonly string[],
  seedKind: SeedKind,
): AgentTools {
  return {
    async findEntity(query) {
      const found = await searchCandidates(get, key, query);
      if (found.status !== "ok") return { ok: false };
      return { ok: true, candidates: found.candidates };
    },
    async readPartners(entityId, category) {
      const entry = graphCategory(category);
      if (!entry) return { ok: false };
      const result = await categoryInsights(get, key, entityId, entry, 20, 3, seedTags, seedKind);
      if (result === "auth" || result.status === "unavailable") return { ok: false };
      return { ok: true, hits: result.hits };
    },
  };
}

export type { ToolResult };
