import { type GroqMessage, type GroqTool, type GroqToolCall, groqChatRetry } from "@/lib/groq.server";
import type { AgentCall, AgentModel, AgentTools, PartnerCategory, ToolResult } from "@/lib/kinship-agent";
import { categoryInsights, graphCategory, searchCandidates, type QlooGetter, type SeedKind } from "@/lib/kinship-resolve";

// Server-only adapters. Groq (gpt-oss-20b) is the agent's brain (it sees tool results and
// decides the next call or the final sentence). Qloo is reached only through the injected
// getter, which is the single hackathon.api.qloo.com proxy in kinship-door. Keys never leave here.

const SYSTEM = [
  "You are the research step of a partnership pitch tool.",
  "Use the tools to find the seed's strongest partner signals, then reply with one short sentence.",
  "Call find_entity only if you need another name. Call read_partners to read audience overlap for an entity you have seen.",
  "The final sentence may only name entities and numbers that appear in tool results. Do not claim a partnership exists.",
  "Reply with plain text, one sentence, when you are finished or when you are told no more calls are allowed.",
].join(" ");

const TOOLS: GroqTool[] = [
  {
    type: "function",
    function: {
      name: "find_entity",
      description: "Search Qloo for an entity by name. Returns up to five candidates with entity_id.",
      parameters: {
        type: "object",
        properties: { query: { type: "string", description: "name to look up" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_partners",
      description: "Read audience-overlap partners for a seen entity in one category. Returns hits with score.",
      parameters: {
        type: "object",
        properties: {
          entity_id: { type: "string" },
          category: { type: "string", enum: ["brand", "place", "destination", "artist"] },
        },
        required: ["entity_id", "category"],
      },
    },
  },
];

function parseArgs(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function createGroqModel(apiKey: string, seedName: string): AgentModel {
  const history: GroqMessage[] = [{ role: "system", content: SYSTEM }];
  let started = false;
  // Tool-call ids from the last assistant turn, in the same order as the calls we ran.
  let pendingIds: string[] = [];
  return {
    async next(results, final) {
      if (!started) {
        started = true;
        history.push({ role: "user", content: `Seed: ${seedName}. Start by reading partners.` });
      } else if (results) {
        results.forEach((result, index) => {
          history.push({
            role: "tool",
            tool_call_id: pendingIds[index] ?? `call_${index}`,
            content: JSON.stringify({ ok: result.ok, data: result.data }),
          });
        });
      }
      if (final) history.push({ role: "user", content: "No more tool calls. Write the one-sentence answer now." });
      const reply = await groqChatRetry({
        apiKey,
        messages: history,
        maxTokens: 200,
        timeoutMs: 20000,
        tools: final ? undefined : TOOLS,
      });
      const toolCalls: GroqToolCall[] = reply.toolCalls ?? [];
      const parsed: AgentCall[] = [];
      const kept: GroqToolCall[] = [];
      if (toolCalls.length > 0 && !final) {
        for (const call of toolCalls) {
          const args = parseArgs(call.function?.arguments ?? "");
          if (call.function?.name === "find_entity") {
            parsed.push({ name: "find_entity", args: { query: String(args.query ?? "") } });
            kept.push(call);
          }
          if (call.function?.name === "read_partners") {
            parsed.push({
              name: "read_partners",
              args: { entity_id: String(args.entity_id ?? ""), category: String(args.category ?? "") as PartnerCategory },
            });
            kept.push(call);
          }
        }
      }
      if (parsed.length > 0) {
        pendingIds = kept.map((call) => call.id);
        history.push({ role: "assistant", content: reply.content, tool_calls: kept });
        return { kind: "calls", calls: parsed };
      }
      const text = reply.content;
      if (typeof text !== "string" || !text.trim()) throw new Error("no text");
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
