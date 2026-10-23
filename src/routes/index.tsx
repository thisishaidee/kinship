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
const VALUE_PROPS = [
  {
    title: "Only real data",
    lines: [
      "Every name and score comes straight from Qloo's taste graph.",
      "Kinship never invents a partner. No exact match means no result.",
    ],
  },
  {
    title: "Grounded explanations",
    lines: [
      "A one-line why, written by AI.",
      "It is told to use only the exact scores Qloo returned, and to say nothing if it cannot.",
    ],
  },
  {
    title: "Pitch-ready output",
    lines: [
      "One tap exports a clean one-page PDF brief.",
      "It carries the pairing, the scores, and the affinity disclaimer.",
    ],
  },
];
function MockSeeds() {
  return (
    <div className="relative flex h-28 w-full min-w-0 items-center justify-between overflow-hidden rounded-xl border border-line bg-bg px-3 py-3">
      <div className="flex min-w-0 flex-col gap-1.5">
        {SEEDS.map((seed) => (
          <span key={seed} className="w-fit max-w-full truncate rounded-full border border-line bg-surface px-2 py-0.5 text-[10px] leading-tight text-fg">
            {seed}
          </span>
        ))}
      </div>
      <svg viewBox="0 0 100 60" preserveAspectRatio="none" className="absolute inset-y-0 left-[30%] h-full w-[30%]" aria-hidden="true">
        <path d="M0 10 C50 10 50 30 100 30 M0 30 L100 30 M0 50 C50 50 50 30 100 30" fill="none" stroke="#3f3f46" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="relative flex shrink-0 items-center gap-2">
        <span className="flex size-9 items-center justify-center rounded-full border-2 border-accent">
          <span className="size-2 rounded-full bg-accent" />
        </span>
        <span className="flex items-center gap-2 rounded-lg border border-line bg-surface px-2 py-1">
          <span className="text-[10px] text-muted">{RESULTS[0].name}</span>
          <span className="font-sans text-xs font-semibold text-accent">{RESULTS[0].score}</span>
        </span>
      </div>
    </div>
  );
}

function MockExplanation() {
  return (
    <div className="flex h-28 w-full min-w-0 flex-col justify-center gap-3 overflow-hidden rounded-xl border border-line bg-bg p-3">
      <div className="flex min-w-0 items-start gap-2 rounded-lg border border-line bg-surface p-2.5">
        <p className="min-w-0 flex-1 break-words text-[11px] leading-snug text-fg">
          Audience affinity links {SEEDS[1]} with {RESULTS[0].name} in the taste graph.
        </p>
        <span className="shrink-0 rounded-md border border-accent/60 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-accent">
          {RESULTS[0].score}
        </span>
      </div>
      <div className="h-1 w-3/4 rounded-full bg-line" />
      <div className="h-1 w-1/2 rounded-full bg-line" />
    </div>
  );
}

function MockBrief() {
  return (
    <div className="flex h-28 w-full min-w-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-bg p-3">
      <div className="flex h-full w-[62%] max-w-[120px] flex-col gap-1.5 rounded-md border border-line bg-white p-2">
        <div className="h-2 w-4/5 rounded-sm bg-[#3f3f46]" />
        <div className="h-px w-full bg-[#d4d4d8]" />
        <div className="h-1 w-full rounded-full bg-[#d4d4d8]" />
        <div className="h-1 w-11/12 rounded-full bg-[#d4d4d8]" />
        <div className="h-1 w-3/4 rounded-full bg-[#d4d4d8]" />
        <div className="mt-auto h-6 w-full rounded-sm bg-accent" />
      </div>
    </div>
  );
}

const VALUE_MOCKS = [MockSeeds, MockExplanation, MockBrief];

const REPO = "https://github.com/thisishaidee/kinship";

const pillBase = "inline-flex items-center justify-center rounded-full text-sm font-medium transition-colors";

function Landing() {
  return (
    <div data-landing="v2" className="flex w-full flex-col overflow-x-hidden bg-bg text-fg">
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

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-5 pb-12 pt-10 sm:gap-24 sm:pb-16 sm:pt-24">
        <section className="flex flex-col items-center gap-7 text-center">
          <span className="inline-flex items-center rounded-full border border-accent/70 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.24em] text-accent">
            Powered by Qloo
          </span>
          <h1 className="flex max-w-3xl flex-col items-center font-sans text-[40px] font-semibold leading-[1.05] tracking-tight text-white break-words sm:text-[56px]">
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

        <section aria-labelledby="why-kinship" className="flex flex-col gap-8">
          <div className="flex max-w-2xl flex-col gap-3">
            <p className="text-xs font-medium uppercase tracking-[0.22em] text-accent">The promise</p>
            <h2 id="why-kinship" className="scroll-mt-24 font-sans text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Why Kinship
            </h2>
          </div>
          <ul className="grid gap-4 md:grid-cols-3">
            {VALUE_PROPS.map((prop, index) => {
              const Mock = VALUE_MOCKS[index];
              return (
              <li key={prop.title} className="flex min-w-0 flex-col gap-4 rounded-2xl border border-[#27272A] bg-[#111113] p-5 sm:p-6">
                <Mock />
                <span className="font-sans text-sm font-semibold leading-none text-accent">{String(index + 1).padStart(2, "0")}</span>
                <h3 className="font-sans text-xl font-semibold tracking-tight text-white">{prop.title}</h3>
                <div className="flex flex-col gap-2">
                  {prop.lines.map((line) => (
                    <p key={line} className="text-sm leading-relaxed text-muted">
                      {line}
                    </p>
                  ))}
                </div>
              </li>
              );
            })}
          </ul>
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
                className="flex flex-col gap-6 rounded-2xl border border-line bg-surface p-5 shadow-[0_16px_32px_-24px_rgba(0,0,0,0.9)] last:sm:col-span-2 lg:last:col-span-1"
              >
                <span className="font-sans text-3xl font-semibold leading-none text-accent">{String(index + 1).padStart(2, "0")}</span>
                <span className="text-sm leading-snug text-fg">{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <section aria-label="Compare example" className="flex w-full min-w-0 flex-col gap-4">
          <figure className="overflow-hidden rounded-2xl border border-line bg-surface">
            <img
              src="/compare-view.png"
              alt="Kinship compare of Nike and Adidas, with shared Qloo affinities and a two-sentence explanation."
              className="block h-auto w-full max-w-full"
              loading="lazy"
            />
          </figure>
        </section>

        <p className="mx-auto max-w-3xl text-center text-sm leading-relaxed text-muted">{DISCLAIMER}</p>
      </main>

      <footer className="mt-16 border-t border-line bg-bg sm:mt-24">
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
      <div className="flex items-end justify-between gap-3 border-t border-line pt-2">
        <span className="text-[9px] font-medium uppercase tracking-[0.22em] text-muted/80">affinity</span>
        <span className="font-sans text-2xl font-medium leading-none tracking-[-0.02em] tabular-nums text-accent/90">{score}</span>
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
