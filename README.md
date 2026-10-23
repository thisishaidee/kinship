# Kinship

Kinship finds cross-domain partnership fits between artists, films, and brands, using audience affinity data from the Qloo taste graph. Type a name, get scored pitch cards or a side-by-side comparison, and export a one-page PDF. Every partner name and score comes from Qloo's response. Kinship does not invent partners.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Built with Vite](https://img.shields.io/badge/built%20with-Vite-646CFF.svg)](https://vite.dev)
[![Written in TypeScript](https://img.shields.io/badge/written%20in-TypeScript-3178C6.svg)](https://www.typescriptlang.org)

**Live demo:** https://kinshipp.vercel.app
**Tool:** https://kinshipp.vercel.app/app (the landing page is at `/`, the search tool is at `/app`)

---

## Table of contents

- [What is Kinship](#what-is-kinship)
- [How it works](#how-it-works)
- [Features](#features)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
- [Project structure](#project-structure)
- [Design principles](#design-principles)
- [Disclaimer](#disclaimer)
- [License](#license)
- [Author](#author)

---

## What is Kinship

Finding a partner across domains is hard. A musician might suit a sneaker brand, a film might suit a fragrance label, and a brand might suit an artist it has never considered. Finding those matches usually means guessing from press coverage or following hunches, and the result is often a list of names that sound plausible but have no evidence behind them.

Kinship approaches the problem from audience data. It asks Qloo's taste graph which brands, places, destinations, and artists have a measurable affinity with the audience of the seed you entered. Those affinities are returned as named entities with scores. Kinship shows what came back and nothing more.

The rules that follow from this:

- A partner appears only if Qloo returned it, with its score.
- A seed with no exact match in Qloo is reported as no match. Kinship does not substitute a similar name.
- The explanation text may only reference names and scores that appear in the Qloo response.
- The output is labeled as affinity, not as evidence that a partnership exists or would succeed.

## How it works

1. **You enter a seed.** Type an artist, film, or brand, or tap one of the example chips (Radiohead, Nike, Davido). Use **Find partners** for pitch cards, or switch to **Compare** and enter two names.
2. **Qloo resolves the entity.** The server calls `GET /search` on `https://hackathon.api.qloo.com` with your text and the three entity types Kinship supports (`urn:entity:artist`, `urn:entity:movie`, `urn:entity:brand`). Only exact name matches are kept. If several entities share that exact name, you pick which one you mean. If none match, Kinship stops and says so.
3. **Affinity queries run.** For the resolved entity, the server calls `GET /v2/insights` once per category: brand, place, destination, and artist. Each call uses `signal.interests.entities` set to the resolved entity ID. Each hit keeps its name, its Qloo affinity score, and its entity ID. Hits without a score are dropped.
4. **Results are shown.** For pitch cards, the three categories with the strongest scores become cards. Each card lists its top names and their scores. For compare, the two seeds are resolved and their results are intersected. Shared affinities are listed with both scores.
5. **Optional explanation.** If the server has a `GEMINI_API_KEY`, compare sends the shared-affinity evidence to `gemini-3.5-flash` through `@google/genai` and asks for a two-sentence explanation. The reply is checked before it is shown (see [Features](#features)). If it fails any check, or if no key is configured, the page shows a sentence built from the scores instead.
6. **One-page PDF export.** The compare view can be exported as `kinship-pairing.pdf`. The PDF is generated in the browser and contains both names, the shared affinities with scores, the explanation, and the disclaimer.

## Features

- **Seed search.** One text field for an artist, film, or brand. Exact-name matching against Qloo's search, with a chooser when the name is ambiguous.
- **Example chips.** Radiohead, Nike, and Davido are one tap away for a quick look at the output.
- **Pitch cards.** Up to three categories (brands, places, destinations, artists) with their strongest Qloo affinity hits and scores. Each name links to a web search for that name, so you can check it yourself.
- **Compare mode.** Two entities side by side. If both resolve, Kinship lists the shared affinities, sorted by the weaker of the two scores, and the strongest overlaps lead.
- **Grounded LLM explanation.** The model receives only the Qloo evidence as JSON and runs at temperature 0 with no extended thinking. Its reply is accepted only if it is exactly two sentences, mentions no numbers except scores Qloo returned, uses no capitalized word that is not part of the seed names or the shared affinity names (plus a short list of ordinary words), and makes no claim of an available or guaranteed partnership. Otherwise the score-based sentence is shown and labeled as such.
- **Score-only fallback.** Without `GEMINI_API_KEY`, or when the model call fails or times out (20 seconds), compare still works. The page shows the Qloo scores and a sentence that states them.
- **One-tap PDF export.** A single action produces `kinship-pairing.pdf`, with the pairing, the shared affinities, the explanation, and the disclaimer on one page. On browsers that support sharing files, the PDF is offered through the share sheet.
- **Copy line.** Pitch cards can copy their sentence to the clipboard.
- **Honest no-match handling.** Each failure has its own message: no exact match, several exact matches (you choose), the server is missing its Qloo key, Qloo refused the key, Qloo did not respond, or a seed resolved but no category returned a score. Kinship never fills these gaps with invented partners.
- **Disclaimer.** The disclaimer appears on the results and in the exported PDF: scores show taste-graph affinity, not partnership availability, and they are not the chance a partnership succeeds.

## Tech stack

- **[Vite](https://vite.dev)** for the development server and production build.
- **[TypeScript](https://www.typescriptlang.org)** across the client and the server functions.
- **[TanStack Start](https://tanstack.com/start)** and **TanStack Router** for routing and server functions (`createServerFn`). Routes: `/` (landing) and `/app` (the tool).
- **React 19** and **Tailwind CSS 4** for the interface.
- **[@google/genai](https://www.npmjs.com/package/@google/genai)** calling `gemini-3.5-flash`, used only for the optional compare explanation.
- **[Qloo API](https://developer.qloo.com)** for entity search (`/search`) and audience affinity insights (`/v2/insights`). Kinship uses the hackathon base URL `https://hackathon.api.qloo.com`.

## Getting started

### Prerequisites

- **Node.js 22** is recommended. The test script runs TypeScript test files with `--experimental-strip-types`, which Node 22 supports.
- **npm** (ships with Node).
- A **Qloo API key** for the hackathon API. Kinship cannot resolve or score anything without it.
- Optional: a **Gemini API key** for the compare explanation.

### Install

```bash
git clone https://github.com/thisishaidee/kinship.git
cd kinship
npm install
```

### Environment variables

| Variable | Required | Used for |
| --- | --- | --- |
| `QLOO_API_KEY` | Yes | Sent as the `X-Api-Key` header on every Qloo request. Read on the server only. Without it, Kinship shows that the key is not configured on the server. |
| `GEMINI_API_KEY` | No | Enables the grounded two-sentence compare explanation through `gemini-3.5-flash`. Read on the server only. Without it, compare shows the score-based sentence and nothing else changes. |
| `DATABASE_URL` | No | Used only by the build's migration step if set. Kinship's search, compare, and PDF features do not need a database. |

Put the keys in a local `.env` file or export them in your shell. Do not commit keys, and do not place them in client-side code. The Qloo key is read on the server, from the `QLOO_API_KEY` environment variable or a local secrets file, and is never sent to the browser. The page sends only the seed text (and an entity ID when you pick from a list).

### Run the dev server

```bash
QLOO_API_KEY=your_key_here GEMINI_API_KEY=your_key_here npm run dev
```

The dev server listens on `http://localhost:8080`. Open `/app` to use the tool.

### Build

```bash
npm run build
```

The build runs Vite, then the migration script. The migration step is skipped when `DATABASE_URL` is not set.

### Other scripts

| Command | What it does |
| --- | --- |
| `npm run preview` | Serves the production build locally. |
| `npm test` | Runs the Node test suites, including the Kinship resolve and compare tests. |
| `npm run typecheck` | Runs `tsc --noEmit`. |
| `npm run lint` | Runs ESLint. |
| `npm run format` | Runs Prettier across the project. |

## Project structure

```
kinship/
├── src/
│   ├── routes/
│   │   ├── __root.tsx          Root layout, document shell, and page metadata
│   │   ├── index.tsx           Landing page at / (story, steps, disclaimer, link to /app)
│   │   └── app.tsx             The tool at /app: seed search, pitch cards, compare, PDF export
│   ├── lib/
│   │   ├── kinship-door.ts     Server functions: Qloo HTTP calls, key lookup, Gemini explanation
│   │   ├── kinship-resolve.ts  Entity search, exact-match rules, insight queries, pitch building
│   │   ├── kinship-resolve.test.ts
│   │   ├── kinship-compare.ts  Shared-affinity intersection, grounding checks, fallback sentence
│   │   ├── kinship-compare.test.ts
│   │   ├── kinship-pdf.ts      One-page PDF builder and the disclaimer text
│   │   └── env.server.ts       Reads environment variables on the server
│   ├── components/             Shared UI pieces
│   ├── router.tsx              Router setup
│   └── styles.css              Global styles
├── public/                     Static assets served as-is
├── scripts/
│   ├── with-app-env.mjs        Loads app environment settings before running Vite
│   ├── migrate.mjs             Applies SQL files in migrations/ when DATABASE_URL is set
│   └── *.test.mjs              Node tests for the scripts above
├── migrations/                 SQL migrations applied at build time
├── server/                     Server middleware
├── package.json                Scripts and dependencies
├── vite.config.ts              Vite configuration
├── tsconfig.json               TypeScript configuration
├── vercel.json                 Vercel install settings
└── LICENSE                     MIT license
```

Inside `src/lib/`, the Kinship logic is split so each part can be tested on its own. `kinship-resolve.ts` decides what counts as an exact match and which affinities are kept. `kinship-compare.ts` decides which overlaps are shared and whether the model's explanation is safe to show. `kinship-door.ts` is the only file that talks to Qloo or Gemini, so the keys stay on the server.

## Design principles

- **Cite only returned Qloo data.** Names, scores, and categories shown to users come directly from Qloo's responses. Nothing is added from memory or from the model.
- **Never fabricate partnerships.** A partner is shown only if it has a Qloo affinity score. Kinship does not suggest partnerships that are not in the data, and it does not claim one exists.
- **Disclaimer first.** The affinity disclaimer appears on the results and in the PDF. The scores are described as affinity, not as availability or success.
- **Fallback over failure.** If the explanation model is unavailable or its output fails the checks, the page shows the score-based sentence. If a category has no score, it is left out instead of being filled in.
- **No invented names.** When a seed has no exact match, Kinship says so and does not offer a similar name.
- **Server-side keys.** Qloo and Gemini calls are made from server functions. The browser never receives either key.

## Disclaimer

Kinship shows audience affinity from Qloo's taste graph. A score means a connection exists in that data. It does not confirm an existing partnership, prove that a new partnership is available, or guarantee business compatibility. The numbers are affinity scores, not the chance a partnership succeeds. Check any partner yourself before reaching out.

## License

Kinship is released under the [MIT License](LICENSE). Copyright (c) 2026 thisishaidee.

## Author

Built by [@thisishaidee](https://github.com/thisishaidee) for the Qloo Agentic Hackathon.
