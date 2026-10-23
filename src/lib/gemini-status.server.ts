export async function geminiReady(): Promise<boolean> {
  const { env } = await import("@/lib/env.server");
  const key = env("GEMINI_API_KEY");
  if (!key) return false;
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey: key });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: "Reply with the single word ok.",
        config: {
          temperature: 0,
          maxOutputTokens: 32,
          thinkingConfig: { thinkingBudget: 0 },
          abortSignal: AbortSignal.timeout(15000),
        },
      });
      if (typeof response.text === "string" && response.text.trim()) return true;
    } catch {
      // Demand spikes are not a missing key. One retry, then not ok.
    }
  }
  return false;
}
