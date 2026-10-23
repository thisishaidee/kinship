import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({ component: Landing });

const DISCLAIMER =
  "Audience affinity reflects a connection in Qloo’s taste graph. It does not confirm an existing partnership, prove that a new partnership is available, or guarantee business compatibility. The numbers are affinity scores, not the chance a partnership succeeds.";

const STEPS = [
  "You enter a name",
  "Qloo resolves the entity",
  "/v2/insights affinity query",
  "Pitch cards or compare",
  "Optional explanation of those scores",
];

function Landing() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-10 px-5 py-8">
      <header className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium tracking-wide text-accent">Kinship</p>
        <a href="https://github.com/thisishaidee/kinship" target="_blank" rel="noopener noreferrer" className="text-sm text-fg underline decoration-1 underline-offset-4">
          GitHub
        </a>
      </header>

      <section className="flex flex-col gap-5">
        <h1 className="font-display text-5xl leading-none text-fg">A partnership, not a playlist.</h1>
        <p className="text-base leading-relaxed text-muted">
          Qloo-powered partnership discovery between artists, films, and brands. One name goes in. The taste graph comes back with scored partners. Kinship does not invent a name.
        </p>
        <Link
          to="/app"
          className="inline-flex h-12 items-center justify-center rounded-card bg-accent px-4 text-base font-medium text-accent-fg"
        >
          Launch app
        </Link>
        <figure className="overflow-hidden rounded-card border border-line bg-surface">
          <img
            src="/compare-view.png"
            alt="Kinship compare of Nike and Adidas, with shared Qloo affinities and a two-sentence explanation."
            className="block w-full"
          />
        </figure>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="how-it-works">
        <h2 id="how-it-works" className="text-sm font-medium text-fg">
          How it works
        </h2>
        <p className="text-sm leading-snug text-muted">
          One name goes to Qloo search, which resolves the exact entity. Kinship then calls /v2/insights for audience affinity. The cards and the compare cite only those scores. A short explanation, when it appears, may only use the names and scores Qloo returned.
        </p>
        <ol className="flex flex-col">
          {STEPS.map((step, index) => (
            <li key={step} className="flex flex-col">
              <div className="flex items-center gap-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-line text-xs font-medium text-accent">{index + 1}</span>
                <span className="text-sm text-fg">{step}</span>
              </div>
              {index < STEPS.length - 1 ? <span className="ml-3.5 h-3 w-px bg-line" aria-hidden="true" /> : null}
            </li>
          ))}
        </ol>
      </section>

      <p className="text-sm leading-snug text-muted">{DISCLAIMER}</p>

      <footer className="mt-auto flex flex-wrap gap-x-3 gap-y-1 border-t border-line pt-4 text-sm text-muted">
        <a href="https://github.com/thisishaidee/kinship" target="_blank" rel="noopener noreferrer" className="text-fg underline decoration-1 underline-offset-4">
          GitHub repository
        </a>
        <a href="https://github.com/thisishaidee/kinship/blob/main/LICENSE" target="_blank" rel="noopener noreferrer" className="text-fg underline decoration-1 underline-offset-4">
          MIT license
        </a>
      </footer>
    </main>
  );
}
