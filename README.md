# Kinship

Zero-fabrication partnership pitches from qloo's taste graph. Type a name, get scored pitch cards or a side-by-side comparison, and export a one-page PDF for a partner.

Live demo: https://kinshipp.vercel.app

The landing page is at `/`, the web tool is at `/app`.

---

## How it works

1. **Enter a seed.** Type an artist, film, or brand, or tap an example chip (Radiohead, Nike, Drake). Use Find partners for pitch cards, or switch to Compare and enter two names.
2. **Qloo resolves the entity.** Exact name matches are used directly. If several entities share that exact name, or Qloo has close matches but no exact one, a "closest results" chooser opens and you pick which one. Nothing is picked for you. Only when Qloo returns zero hits does Kinship stop and say so.
3. **Affinity queries run.** The server queries Qloo's taste graph across brands, places, destinations, and artists. Every hit keeps its name, Qloo affinity score, and entity ID.
4. **Results are shown.** Pitch cards show the strongest scores per category, with a caption and a Copy line button. Compare mode intersects two seeds and ranks shared fans.
5. **Grounded LLM explanation.** Compare sends the shared data to OpenAI's gpt-oss-20b via Groq and writes a grounded two-sentence take. Each pitch card also gets a one-line explanation. Every model-written line is checked against the Qloo data it was given: a name or score it uses must appear in those results, and a line that invents one is thrown away. Falls back to a score-based sentence on any error.
5a. **Agent loop (single search and compare).** Kinship can run a tool-calling agent. The model decides which Qloo reads to make (find an entity, then read its partners by category), within a fixed budget of 6 calls over at most 3 rounds and a 60 second limit. Its final sentence is checked the same way as the other explanations, and it is shown under the results. If the agent fails or runs out of budget, the fixed pipeline runs instead.
6. **One-page PDF export.** A compare report can be exported as `kinship-pairing.pdf` with both names, shared affinities, scores, the explanation, and the disclaimer.

---

## Tech stack

- **Frontend:** React 19, TanStack Start, TanStack Router, Tailwind CSS 4, Inter + JetBrains Mono
- **Backend:** Vite + TypeScript server functions (`createServerFn`), no database needed
- **Data source:** Qloo API for entity search and affinity insights
- **Explanations:** Groq (`openai/gpt-oss-20b`)
- **Deployment:** Vercel

---

## Environment variables

Set these on Vercel or in local `.env` (server-only, never sent to the browser):

| Variable | Required | Used for |
| --- | --- | --- |
| `QLOO_API_KEY` | Yes | Qloo hackathon API auth (X-Api-Key). Without it, Kinship shows the key is missing. |
| `GROQ_API_KEY` | No | Enables the grounded compare explanation via Groq. Without it, compare shows the score-based sentence. |

---

## Local setup

git clone https://github.com/thisishaidee/kinship.git
npm install
`QLOO_API_KEY=... GROQ_API_KEY=... npm run dev`

Open http://localhost:8080 to use the tool.

---

## Design principles

- Cite only returned Qloo data. Nothing is added from memory or from the model.
- Never fabricate partnerships. A partner is shown only if it has a Qloo affinity score.
- Fallback over failure. If the explanation model is unavailable, the page shows the score-based sentence.
- No invented names. When a seed has no exact match, Kinship says so.
- Server-side keys. Qloo and Groq calls are made from server functions. The browser never receives either key.

---

## Disclaimer

Kinship shows audience affinity from Qloo's taste graph. A score means a connection exists in that data. It does not confirm an existing partnership, prove that a new partnership is available, or guarantee business compatibility. The numbers are affinity scores, not the chance a partnership succeeds. Check any partner yourself before reaching out.

---

## License

Mit License. Copyright (c) 2026 thisishaidee.
