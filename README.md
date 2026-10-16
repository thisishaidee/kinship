# Kinship

A phone-first partnership agent for creators and small brands. One seed goes in. Up to three pitches come back. Every name and score has to come from the Qloo taste graph. Kinship does not invent a partner.

## Try it

1. Open the app.
2. Tap **Try Radiohead**, or type an artist, film, or brand and tap **Find partners**.
3. Read the resolved Qloo entity, then the pitch cards.
4. **Copy line** puts the sendable sentence on the clipboard.

## What the server does

The page sends only the seed. The Qloo key never leaves the server.

1. `GET /search` on `https://hackathon.api.qloo.com` for an artist, film, or brand.
2. If nothing matches, Kinship stops and says so.
3. Four `GET /v2/insights` calls, using the resolved entity as the interest signal: brand, place, destination, and artist.
4. Each hit keeps its name and Qloo affinity score. A category with no score is dropped.
5. The three strongest categories become pitch cards. The line cites only those names and scores.

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
QLOO_API_KEY=your_hackathon_key npm run dev
```

The key is an environment variable, or a server-only file the app can read. Do not commit it. Do not put it in the page.

Hackathon base URL: `https://hackathon.api.qloo.com`

## License

MIT
