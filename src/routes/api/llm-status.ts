import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/llm-status")({
  server: {
    handlers: {
      GET: async () => {
        const { groqStatus } = await import("@/lib/groq-status.server");
        const status = await groqStatus();
        return Response.json({ provider: "groq", ok: status.ok, reason: status.reason, detail: status.detail ?? null });
      },
    },
  },
});
