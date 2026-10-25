import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/llm-status")({
  server: {
    handlers: {
      GET: async () => {
        const { geminiStatus } = await import("@/lib/gemini-status.server");
        const status = await geminiStatus();
        return Response.json({ provider: "gemini", ok: status.ok, reason: status.reason, detail: status.detail ?? null });
      },
    },
  },
});
