# Kinship

A phone-first partnership agent for creators and small brands. One seed goes in. Up to three pitches come back. Every name and score has to come from the Qloo taste graph. Kinship does not invent a partner.

## Try it

1. Open the landing page and tap **Launch app**.
2. Tap **Nike**, or type an artist, film, or brand and tap **Find partners**.
3. Read the resolved Qloo entity, then the pitch cards.
4. Switch to **Compare** for two names, a shared-affinity list, and a short explanation.
5. **Copy line** puts the sendable sentence on the clipboard. **Download one-page PDF** saves the compare.

## What the server does

The page sends only the seed. The Qloo key never leaves the server.

1. `GET /search` on `https://hackathon.api.qloo.com` for an artist, film, or brand.
2. If nothing matches, Kinship stops and says so.
3. Four `GET /v2/insights` calls, using the resolved entity as the interest signal: brand, place, destination, and artist.
4. Each hit keeps its name and Qloo affinity score. A category with no score is dropped.
5. The three strongest categories become pitch cards. The line cites only those names and scores.
6. Compare asks Gemini to explain the shared scores. A draft that invents a name or a score is discarded, and the page cites the scores instead.

## Honest failures

| What happened | What you see |
| --- | --- |
| Qloo has no exact name for the seed | No exact match. A similar name is not used. |
| Several entities share that exact name | You choose the artist, film, or brand. |
| The server has no key | The page says the key is not on the server. |
| Qloo refuses the key | The page says the key was refused. |
| Qloo does not answer | Cards stay empty. Try again. |
| The name resolves, but no category has a score | No pitch is invented. |

## Run it

```bash
npm install
QLOO_API_KEY=your_hackathon_key GEMINI_API_KEY=your_gemini_key npm run dev
```

The keys are environment variables. Do not commit them. Do not put them in the page. Without `GEMINI_API_KEY`, compare still shows the score sentence.

Hackathon base URL: `https://hackathon.api.qloo.com`

## License

MIT
