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
    body: "Every name and score comes straight from Qloo's taste graph. No exact match means no result, never a guessed partner.",
  },
  {
    title: "Grounded explanations",
    body: "A one-line why, written by AI from the exact scores Qloo returned. If the data is thin, it says nothing.",
  },
  {
    title: "Pitch-ready output",
    body: "One tap exports a clean one-page PDF brief with the pairing, the scores, and the affinity disclaimer.",
  },
];

function VisualSeedToTaste() {
  return (
    <div className="flex h-36 w-full min-w-0 items-center justify-between gap-2 rounded-xl border border-[#222226] bg-[#0b0b0d] px-4">
      <span className="shrink-0 rounded-full border border-accent/50 bg-accent/10 px-3 py-1 text-xs font-medium text-white">
        {SEEDS[0]}
      </span>
      <span className="relative h-px min-w-0 flex-1 bg-gradient-to-r from-accent/70 via-accent/30 to-transparent">
        <span className="absolute -top-[3px] right-0 size-[7px] rounded-full bg-accent" />
      </span>
      <div className="flex shrink-0 flex-col items-end gap-1.5 rounded-lg border border-[#222226] bg-[#141416] px-3 py-2">
        <span className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">Qloo Taste Graph</span>
        <span className="flex items-baseline gap-2">
          <span className="text-xs text-white">{RESULTS[0].name}</span>
          <span className="font-sans text-sm font-semibold tabular-nums text-accent">{RESULTS[0].score}</span>
        </span>
      </div>
    </div>
  );
}

function VisualAffinityBubble() {
  return (
    <div className="relative flex h-36 w-full min-w-0 flex-col justify-center gap-3 rounded-xl border border-[#222226] bg-[#0b0b0d] px-4">
      <div className="flex min-w-0 flex-col gap-2 rounded-xl border border-[#2a2a2f] bg-[#141416] p-3 shadow-[0_18px_30px_-20px_rgba(0,0,0,0.9)]">
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-accent">
            Affinity Match
          </span>
          <span className="font-sans text-sm font-semibold tabular-nums text-white">{RESULTS[1].score}</span>
        </div>
        <p className="min-w-0 text-xs leading-snug text-zinc-300">
          {SEEDS[1]} and {RESULTS[1].name} sit close together in the taste graph.
        </p>
      </div>
    </div>
  );
}

function VisualExportCard() {
  return (
    <div className="flex h-36 w-full min-w-0 items-center justify-center rounded-xl border border-[#222226] bg-[#0b0b0d] px-4">
      <div className="flex h-28 w-[58%] max-w-[150px] flex-col gap-2 rounded-md border border-[#2a2a2f] bg-[#f4f4f5] p-2.5 shadow-[0_16px_28px_-18px_rgba(0,0,0,0.9)]">
        <div className="flex items-center justify-between">
          <span className="h-1.5 w-1/2 rounded-sm bg-[#18181b]" />
          <span className="size-2 rounded-full bg-accent" />
        </div>
        <div className="h-px w-full bg-[#d4d4d8]" />
        <div className="h-1 w-full rounded-full bg-[#d4d4d8]" />
        <div className="h-1 w-11/12 rounded-full bg-[#d4d4d8]" />
        <div className="h-1 w-3/4 rounded-full bg-[#d4d4d8]" />
        <div className="mt-auto h-4 w-full rounded-sm bg-accent" />
      </div>
    </div>
  );
}

const VALUE_VISUALS = [VisualSeedToTaste, VisualAffinityBubble, VisualExportCard];

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

      <main className="mx-auto flex w-full max-w-6xl flex-col gap-14 px-5 pb-28 pt-8 sm:gap-24 sm:pb-16 sm:pt-24">
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
          <ul className="grid gap-5 md:grid-cols-3">
            {VALUE_PROPS.map((prop, index) => {
              const Visual = VALUE_VISUALS[index];
              return (
                <li key={prop.title} className="flex min-w-0 flex-col rounded-2xl border border-[#222226] bg-[#111114] p-6">
                  <Visual />
                  <h3 className="mt-4 font-sans text-lg font-semibold text-white">{prop.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-400">{prop.body}</p>
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
          <figure className="mx-auto w-full max-w-5xl overflow-hidden rounded-xl border border-[#2a2a2f] bg-[#0b0b0d] shadow-[0_40px_80px_-40px_rgba(0,0,0,0.95)]">
            <div className="flex h-9 items-center gap-2 border-b border-[#222226] bg-[#141416] px-3">
              <span className="size-2.5 rounded-full bg-[#3f3f46]" />
              <span className="size-2.5 rounded-full bg-[#3f3f46]" />
              <span className="size-2.5 rounded-full bg-[#3f3f46]" />
              <span className="ml-3 flex h-5 min-w-0 flex-1 items-center rounded-md bg-[#0b0b0d] px-3 text-[11px] text-zinc-500">
                kinshipp.vercel.app/app
              </span>
            </div>
            <img
              src="/compare-view.png"
              alt="Kinship compare of Nike and Adidas, with shared Qloo affinities and a two-sentence explanation."
              className="block aspect-video h-auto w-full object-cover object-top"
              loading="lazy"
            />
          </figure>
        </section>

        <p className="mx-auto max-w-3xl text-center text-sm leading-relaxed text-muted">{DISCLAIMER}</p>
      </main>

      <footer className="border-t border-line bg-bg pb-6 sm:pb-0">
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
