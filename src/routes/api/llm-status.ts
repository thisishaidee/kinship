import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/llm-status")({
  server: {
    handlers: {
      GET: async () => {
        const { geminiReady } = await import("@/lib/gemini-status.server");
        const ok = await geminiReady();
        return Response.json({ provider: "gemini", ok });
      },
    },
  },
});
