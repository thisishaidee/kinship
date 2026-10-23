import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles } from "lucide-react";
import { KinshipWordmark } from "@/components/kinship-wordmark";

export const Route = createFileRoute("/")({ component: Landing });

const DISCLAIMER =
  "A shared-fans score shows a connection in Qloo’s data. It does not confirm an existing partnership, prove that a new partnership is available, or guarantee business compatibility. The numbers are shared-fans scores, not the chance a partnership succeeds.";

const STEPS = ["type a name", "qloo finds shared fans", "get your partners, compare, export"];

const SEEDS = ["Nike", "Burna Boy", "Dune (2021)"];
const RESULTS = [
  { name: "Wiz Khalifa", score: "0.979" },
  { name: "Air Jordan", score: "0.970" },
  { name: "Real Madrid CF", score: "0.969" },
];
const TRUST = ["Artists", "Film", "Brands", "Places"];
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
            Type an artist, film, or brand. Kinship finds its real partners on Qloo’s data and never invents a name.
          </p>
          <p className="max-w-xl text-base font-medium leading-relaxed text-white sm:text-lg">
            Kinship shows who your fans already love, then helps you pitch them.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link to="/app" className={`${pillBase} h-12 bg-crimson-grad px-7 text-base text-white shadow-[0_10px_28px_-14px_rgba(224,32,44,0.9)]`}>
              Launch app
            </Link>
            <Link to="/app" search={{ try: "Nike" }} className={`${pillBase} h-12 bg-surface px-7 text-base text-fg ring-1 ring-line hover:bg-line/40`}>
              Try Nike
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

        <section aria-label="How Kinship connects a name to partners" className="flex flex-col items-center gap-10">
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
              Every name and score comes straight from Qloo.
            </p>
          </div>
          <ol className="grid gap-2 sm:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3.5">
                <span className="shrink-0 font-mono text-[12px] leading-none tabular-nums text-accent">{String(index + 1).padStart(2, "0")}</span>
                <span className="text-sm leading-snug text-fg">{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <section aria-label="Compare example" className="flex w-full min-w-0 justify-center py-2 sm:py-4">
          <figure className="w-full max-w-3xl overflow-hidden rounded-2xl border border-[#27272A] bg-[#0A0A0A] shadow-[0_28px_50px_-28px_rgba(0,0,0,0.9)]">
            <div className="grid h-11 grid-cols-[3.25rem_minmax(0,1fr)_3.25rem] items-center border-b border-[#27272A] px-2.5 sm:h-12 sm:grid-cols-[4.5rem_minmax(0,1fr)_4.5rem] sm:px-3">
              <div className="flex items-center gap-1 text-[#9CA3AF]" aria-hidden="true">
                <svg viewBox="0 0 16 16" className="size-4" fill="none">
                  <path d="M9.5 3.5 L5 8 l4.5 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <svg viewBox="0 0 16 16" className="size-4" fill="none">
                  <path d="M6.5 3.5 L11 8 l-4.5 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="mx-auto max-w-full truncate rounded-full border border-[#27272A] px-3 py-1 text-center text-[11px] leading-none text-[#9CA3AF] sm:text-xs">
                kinshipp.vercel.app
              </p>
              <span className="sr-only">Browser preview of the Kinship compare</span>
            </div>
            <img
              src="/compare-view.png"
              alt="Desktop Kinship compare of Nike and Adidas, with shared Qloo fans and a one-line explanation."
              width={1920}
              height={1080}
              className="block h-auto w-full"
            />
          </figure>
        </section>

      </main>

      <footer className="border-t border-line bg-bg pb-6 sm:pb-0">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-8 text-sm text-muted">
        <p className="max-w-3xl text-sm leading-relaxed text-muted">{DISCLAIMER}</p>
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
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

function ResultCard({ name, score, top = false, className = "" }: { name: string; score: string; top?: boolean; className?: string }) {
  return (
    <div className={`flex w-full items-baseline justify-between gap-4 rounded-xl border border-line bg-surface px-4 py-3.5 ${className}`}>
      <span className="min-w-0 break-words text-sm font-semibold text-white">{name}</span>
      <span className="flex shrink-0 items-baseline gap-2">
        <span className={`text-[22px] font-medium leading-none tabular-nums ${top ? "text-accent" : "text-[#9CA3AF]"}`}>{score}</span>
        <span className="text-[9px] font-medium uppercase tracking-[0.18em] text-[#9CA3AF]/80">shared-fans score</span>
      </span>
    </div>
  );
}

function HubCircle() {
  return (
    <div className="flex size-28 flex-col items-center justify-center gap-1 rounded-full border border-accent/60 bg-surface text-center shadow-[0_0_0_8px_rgba(224,32,44,0.06)] sm:size-36">
      <span className="text-[10px] uppercase tracking-[0.2em] text-muted">Qloo</span>
      <span className="px-3 text-sm font-semibold leading-tight text-white">Qloo’s data</span>
    </div>
  );
}

function DesktopDiagram() {
  return (
    <div className="relative hidden h-[380px] w-full max-w-4xl md:block" role="img" aria-label="Names Nike, Burna Boy, and Dune connect through Qloo’s data to Wiz Khalifa, Air Jordan, and Real Madrid CF.">
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
        <ResultCard name={RESULTS[0].name} score={RESULTS[0].score} top />
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
          <ResultCard key={result.name} name={result.name} score={result.score} top={result === RESULTS[0]} />
        ))}
      </div>
    </div>
  );
}
