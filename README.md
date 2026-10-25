# Kinship

Zero-fabrication partnership pitches from qloo's taste graph. Type a name, get scored pitch cards or a side-by-side comparison, and export a one-page PDF for a partner.

Live demo: https://kinshipp.vercel.app

The landing page is at `/`, the web tool is at `/app`.

---

## How it works

1. **Enter a seed.** Type an artist, film, or brand, or tap an example chip (Radiohead, Nike, Drake). Use Find partners for pitch cards, or switch to Compare and enter two names.
2. **Qloo resolves the entity.** Only exact name matches are kept. If several entities share that exact name, you pick which one. If none match, Kinship stops and says so. Never substitutes a similar name.
3. **Affinity queries run.** The server queries Qloo's taste graph across brands, places, destinations, and artists. Every hit keeps its name, Qloo affinity score, and entity ID.
4. **Results are shown.** Pitch cards show the strongest scores per category, with a caption and a Copy line button. Compare mode intersects two seeds and ranks shared fans.
5. **Grounded LLM explanation.** Compare sends the shared data to OpenAI's gpt-oss-20b via Groq and writes a grounded two-sentence take. The reply is accepted only if every name and number it uses appears in the returned Qloo scores. Falls back to a score-based sentence on any error.
6. **One-page PDF export.** A compare report can be exported as `kinship-pairing.pdf` with both names, shared affinities, scores, the explanation, and the disclaimer.

---

## Tech stack

- **Frontend:** React 19, TanStack Start, TanStack Router, Tailwind CSS 4, Instrument Serif + Inter + JetBrains Mono
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
