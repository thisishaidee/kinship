import { type GroqMessage, type GroqTool, type GroqToolCall, groqChatRetry } from "@/lib/groq.server";
import type { AgentCall, AgentModel, AgentTools, PartnerCategory, ToolResult } from "@/lib/kinship-agent";
import { categoryInsights, graphCategory, searchCandidates, type QlooGetter, type SeedKind } from "@/lib/kinship-resolve";

// Server-only adapters. Groq (gpt-oss-20b) is the agent's brain (it sees tool results and
// decides the next call or the final sentence). Qloo is reached only through the injected
// getter, which is the single hackathon.api.qloo.com proxy in kinship-door. Keys never leave here.

const SYSTEM = [
  "You are the research step of a partnership pitch tool.",
  "Use the tools to find the seed's strongest partner signals.",
  "Call find_entity only if you need another name. Call read_partners to read audience overlap for an entity you have seen.",
  "When you write the final sentence, write it for a curious friend with no data background: one simple sentence in plain everyday words that says WHY the pairing works, using the fans and brand fit you saw in the tool results.",
  "Do not use these stock phrases: 'Both pull toward', 'most of the same fans', 'huge shared audience', 'reach the same people', 'same crowd'. Build your sentence from your own words and vary its shape: do not open with the same words another side would use.",
  "Name one or two partners only if they appear in the tool results, copied exactly as returned. Never invent a partner or a fact.",
  "Never write any digits, percentages, or decimals in the sentence. Express overlap in plain words only. Use plain commas, never em dashes, en dashes, or hyphens used as dashes. Never ask a question: no question marks, no offers like 'want to pitch them?'. Use simple grammar and plain everyday words.",
  "Keep it to one short sentence. Never more than two sentences. Do not claim a partnership exists.",
  "Reply with plain text only, no preamble, when you are finished or when you are told no more calls are allowed.",
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

// `angle` is a per-side hint so the two compare sides open with different wording.
export function createGroqModel(apiKey: string, seedName: string, angle?: string): AgentModel {
  const history: GroqMessage[] = [{ role: "system", content: angle ? `${SYSTEM} ${angle}` : SYSTEM }];
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
      if (final) history.push({ role: "user", content: "No more tool calls. Write one short, warm, plain-language sentence now for a curious friend explaining WHY the pairing works in one simple sentence. Vary your wording and sentence shape, and do not use the phrases 'Both pull toward', 'most of the same fans', 'huge shared audience', 'reach the same people', or 'same crowd'. Name at most two partners, copied exactly from the tool results. Write no digits, percentages, or decimals; express overlap in words only. Use plain commas, no em dashes or en dashes, no question marks. Never more than two sentences. Plain grammar. No preamble." });
      const reply = await groqChatRetry({
        apiKey,
        messages: history,
        // 200 tokens is spent on reasoning, so the visible sentence comes back empty.
        maxTokens: 2048,
        timeoutMs: 20000,
        tools: final ? undefined : TOOLS,
        reasoningEffort: "low",
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
