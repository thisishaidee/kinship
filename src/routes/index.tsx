import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles } from "lucide-react";
import { KinshipWordmark } from "@/components/kinship-wordmark";

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

const SEEDS = ["Nike", "Burna Boy", "Dune (2021)"];
const RESULTS = [
  { name: "Wiz Khalifa", score: "0.979" },
  { name: "Air Jordan", score: "0.970" },
  { name: "Real Madrid CF", score: "0.969" },
];
const TRUST = ["Music", "Film", "Brands", "Places"];
const REPO = "https://github.com/thisishaidee/kinship";

const pillBase = "inline-flex items-center justify-center rounded-full text-sm font-medium transition-colors";

function Landing() {
  return (
    <div data-landing="v2" className="flex min-h-dvh w-full flex-col overflow-x-hidden bg-bg text-fg">
      <header className="sticky top-0 z-20 border-b border-line/60 bg-bg/90 backdrop-blur">
        <nav className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-2 px-5">
          <Link to="/" aria-label="Kinship home" className="shrink-0">
            <KinshipWordmark />
          </Link>
          <div className="flex items-center gap-2">
            <a
              href={REPO}
              target="_blank"
              rel="noopener noreferrer"
              className={`${pillBase} h-9 bg-surface px-3 text-xs text-fg ring-1 ring-line sm:px-4 sm:text-sm`}
            >
              View repo
            </a>
            <Link
              to="/app"
              className={`${pillBase} h-9 gap-2 bg-crimson-grad pl-4 pr-1.5 text-sm text-white shadow-[0_6px_18px_-10px_rgba(224,32,44,0.9)]`}
            >
              Launch app
              <span className="flex size-6 items-center justify-center rounded-full bg-white">
                <ArrowRight className="size-3.5 text-accent" aria-hidden="true" strokeWidth={2.5} />
              </span>
            </Link>
          </div>
        </nav>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-24 px-5 pb-16 pt-16 sm:gap-32 sm:pt-24">
        <section className="flex flex-col items-center gap-7 text-center">
          <span className="inline-flex items-center rounded-full border border-accent/70 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.24em] text-accent">
            Powered by Qloo
          </span>
          <h1 className="flex max-w-3xl flex-col items-center font-sans text-[40px] font-semibold leading-[1.05] tracking-tight text-white sm:text-[56px]">
            <span>A partnership,</span>
            <span className="font-display text-accent italic">not a playlist.</span>
          </h1>
          <p className="max-w-xl text-base leading-relaxed text-muted sm:text-lg">
            Type an artist, film, or brand. Kinship finds its real partners on the Qloo taste graph, and never invents a name.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link to="/app" className={`${pillBase} h-12 bg-crimson-grad px-7 text-base text-white shadow-[0_10px_28px_-14px_rgba(224,32,44,0.9)]`}>
              Launch app
            </Link>
            <a href="#how-it-works" className={`${pillBase} h-12 bg-surface px-7 text-base text-fg ring-1 ring-line hover:bg-line/40`}>
              How it works
            </a>
          </div>
        </section>

        <section aria-label="Trust" className="flex flex-col items-center gap-4">
          <p className="text-sm text-muted">Powered by Qloo</p>
          <ul className="flex flex-wrap items-center justify-center gap-2">
            {TRUST.map((chip) => (
              <li key={chip} className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-medium text-muted">
                {chip}
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="How Kinship connects a seed to partners" className="flex flex-col items-center gap-10">
          <DesktopDiagram />
          <MobileDiagram />
        </section>

        <section className="flex flex-col gap-8" aria-labelledby="how-it-works">
          <div className="flex max-w-2xl flex-col gap-3">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-accent">The flow</p>
            <h2 id="how-it-works" className="scroll-mt-24 font-sans text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              How it works
            </h2>
            <p className="text-base leading-relaxed text-muted">
              One name goes to Qloo search, which resolves the exact entity. Kinship then calls /v2/insights for audience affinity. The cards and the compare cite only those scores. A short explanation, when it appears, may only use the names and scores Qloo returned.
            </p>
          </div>
          <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {STEPS.map((step, index) => (
              <li
                key={step}
                className="flex flex-col gap-6 rounded-2xl border border-line bg-surface p-5 shadow-[0_16px_32px_-24px_rgba(0,0,0,0.9)]"
              >
                <span className="font-sans text-3xl font-semibold leading-none text-accent">{String(index + 1).padStart(2, "0")}</span>
                <span className="text-sm leading-snug text-fg">{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <section aria-label="Compare example" className="flex flex-col gap-4">
          <figure className="overflow-hidden rounded-2xl border border-line bg-surface">
            <img
              src="/compare-view.png"
              alt="Kinship compare of Nike and Adidas, with shared Qloo affinities and a two-sentence explanation."
              className="block w-full"
              loading="lazy"
            />
          </figure>
        </section>

        <p className="mx-auto max-w-3xl text-center text-sm leading-relaxed text-muted">{DISCLAIMER}</p>
      </main>

      <footer className="mt-auto border-t border-line bg-bg">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 py-8 text-sm text-muted">
          <KinshipWordmark />
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <a href={REPO} target="_blank" rel="noopener noreferrer" className="text-fg underline decoration-1 underline-offset-4 hover:text-white">
              GitHub repository
            </a>
            <a
              href="https://github.com/thisishaidee/kinship/blob/main/LICENSE"
              target="_blank"
              rel="noopener noreferrer"
              className="text-fg underline decoration-1 underline-offset-4 hover:text-white"
            >
              MIT license
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function SeedPill({ label, className = "" }: { label: string; className?: string }) {
  return (
    <span className={`inline-flex w-fit items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 text-sm font-medium text-fg ${className}`}>
      <Sparkles className="size-3.5 text-accent" aria-hidden="true" />
      {label}
    </span>
  );
}

function ResultCard({ name, score, className = "" }: { name: string; score: string; className?: string }) {
  return (
    <div className={`flex w-full flex-col gap-2 rounded-2xl border border-line bg-surface p-4 ${className}`}>
      <span className="text-sm font-semibold text-fg">{name}</span>
      <div className="flex items-baseline gap-2">
        <span className="font-sans text-3xl font-semibold tabular-nums leading-none text-accent">{score}</span>
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted">affinity</span>
      </div>
    </div>
  );
}

function HubCircle() {
  return (
    <div className="flex size-28 flex-col items-center justify-center gap-1 rounded-full border border-accent/60 bg-surface text-center shadow-[0_0_0_8px_rgba(224,32,44,0.06)] sm:size-36">
      <span className="text-[10px] uppercase tracking-[0.2em] text-muted">Qloo</span>
      <span className="px-3 text-sm font-semibold leading-tight text-white">taste graph</span>
    </div>
  );
}

function DesktopDiagram() {
  return (
    <div className="relative hidden h-[380px] w-full max-w-4xl md:block" role="img" aria-label="Seeds Nike, Burna Boy, and Dune connect through the Qloo taste graph to Wiz Khalifa, Air Jordan, and Real Madrid CF.">
      <svg className="absolute inset-0 size-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {[16, 50, 84].map((y) => (
          <line key={`l${y}`} x1="19" y1={y} x2="42" y2="50" stroke="#3f3f46" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        ))}
        {[16, 50, 84].map((y) => (
          <line key={`r${y}`} x1="58" y1="50" x2="76" y2={y} stroke="#3f3f46" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      <div className="absolute left-0 top-[16%] -translate-y-1/2">
        <SeedPill label={SEEDS[0]} />
      </div>
      <div className="absolute left-0 top-1/2 -translate-y-1/2">
        <SeedPill label={SEEDS[1]} />
      </div>
      <div className="absolute left-0 top-[84%] -translate-y-1/2">
        <SeedPill label={SEEDS[2]} />
      </div>
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <HubCircle />
      </div>
      <div className="absolute right-0 top-[16%] w-[210px] -translate-y-1/2">
        <ResultCard name={RESULTS[0].name} score={RESULTS[0].score} />
      </div>
      <div className="absolute right-0 top-1/2 w-[210px] -translate-y-1/2">
        <ResultCard name={RESULTS[1].name} score={RESULTS[1].score} />
      </div>
      <div className="absolute right-0 top-[84%] w-[210px] -translate-y-1/2">
        <ResultCard name={RESULTS[2].name} score={RESULTS[2].score} />
      </div>
    </div>
  );
}

function MobileDiagram() {
  return (
    <div className="flex w-full max-w-sm flex-col items-stretch gap-3 md:hidden">
      <div className="flex flex-col items-start gap-2">
        {SEEDS.map((seed) => (
          <SeedPill key={seed} label={seed} />
        ))}
      </div>
      <div className="flex flex-col items-center gap-1 py-1" aria-hidden="true">
        <span className="h-6 w-px bg-line" />
        <HubCircle />
        <span className="h-6 w-px bg-line" />
      </div>
      <div className="flex flex-col gap-3">
        {RESULTS.map((result) => (
          <ResultCard key={result.name} name={result.name} score={result.score} />
        ))}
      </div>
    </div>
  );
}
