import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles } from "lucide-react";
import { KinshipWordmark } from "@/components/kinship-wordmark";
import { getHeroResults, type HeroResult } from "@/lib/kinship-door";

export const Route = createFileRoute("/")({
  loader: () => getHeroResults(),
  component: Landing,
});

const REPO = "https://github.com/thisishaidee/kinship";

const CLAIMS = [
  { head: "One seed.", body: "Type one name. Kinship looks it up on Qloo’s taste graph and shows the artists, brands and films its fans already love. You never have to invent a partner from thin air." },
  { head: "Real fans, not surveys.", body: "Every score comes from Qloo’s live data on what real people actually listen to, watch and wear. Nobody ticked a box, so the numbers hold up in a pitch." },
  { head: "You can read why.", body: "When you compare two names, Kinship explains the match in plain sentences. You can repeat the reasoning out loud to anyone, no data science needed." },
];

const FOOT_COLS = [
  { label: "Product", links: [{ t: "Open app", to: "/app" }, { t: "How it works", href: "#how-it-works" }] },
  { label: "Data", links: [{ t: "Qloo attribution", href: "https://www.qloo.com" }, { t: "Methodology", href: REPO + "#readme" }] },
  { label: "Company", links: [{ t: "About", href: REPO }, { t: "Contact", href: REPO + "/issues" }] },
];

const SEEDS = ["Nike", "Burna Boy", "Dune (2021)"];
const TRUST = ["Artists", "Film", "Brands", "Places"];

const pillBase = "inline-flex items-center justify-center rounded-full text-sm font-medium transition-colors";

function Landing() {
  const results = Route.useLoaderData() as HeroResult[] | null;
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
          <DesktopDiagram results={results} />
          <MobileDiagram results={results} />
        </section>

        <section className="flex flex-col" aria-labelledby="how-it-works">
          <h2 id="how-it-works" className="scroll-mt-24 pb-10 font-sans text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            How it works
          </h2>
          {CLAIMS.map((claim) => (
            <div key={claim.head} className="flex flex-col gap-3 border-t border-white/10 py-14 first:border-t sm:py-20">
              <p className="font-sans text-xl font-semibold tracking-tight text-white sm:text-2xl">{claim.head}</p>
              <p className="max-w-xl text-base leading-relaxed text-muted sm:text-lg">{claim.body}</p>
            </div>
          ))}
        </section>


      </main>

      <footer className="border-t border-white/10 bg-bg">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-5 py-20">
          <div className="flex flex-col gap-12 md:flex-row md:justify-between md:gap-24">
            <div className="flex max-w-xs flex-col gap-5">
              <KinshipWordmark />
              <p className="text-sm text-white">Partner discovery from shared fans.</p>
              <a href={REPO + "/issues"} target="_blank" rel="noopener noreferrer" className="text-sm text-white hover:underline underline-offset-4">
                Contact on GitHub
              </a>
            </div>
            <nav aria-label="Footer" className="grid grid-cols-2 gap-12 sm:grid-cols-3 sm:gap-16">
              {FOOT_COLS.map((col) => (
                <div key={col.label} className="flex flex-col gap-4">
                  <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-muted">{col.label}</p>
                  {col.links.map((link) =>
                    "to" in link ? (
                      <Link key={link.t} to={link.to} className="text-sm text-white hover:underline underline-offset-4">
                        {link.t}
                      </Link>
                    ) : (
                      <a
                        key={link.t}
                        href={link.href}
                        {...((link.href ?? "").startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                        className="text-sm text-white hover:underline underline-offset-4"
                      >
                        {link.t}
                      </a>
                    ),
                  )}
                </div>
              ))}
            </nav>
          </div>
          <div className="flex flex-col gap-3 border-t border-white/10 pt-8 text-xs text-muted sm:flex-row sm:justify-between">
            <p>affinity scores come from qloo's taste graph, not surveys. beta: scores are estimates.</p>
            <p>© 2026 Kinship</p>
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

function DesktopDiagram({ results }: { results: HeroResult[] | null }) {
  return (
    <div className="relative hidden h-[380px] w-full max-w-4xl md:block" role="img" aria-label="Names Nike, Burna Boy, and Dune connect through Qloo’s data to partner names.">
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
      {results?.[0] ? (
        <div className="absolute right-0 top-[16%] w-[210px] -translate-y-1/2">
          <ResultCard name={results[0].name} score={results[0].score} top />
        </div>
      ) : null}
      {results?.[1] ? (
        <div className="absolute right-0 top-1/2 w-[210px] -translate-y-1/2">
          <ResultCard name={results[1].name} score={results[1].score} />
        </div>
      ) : null}
      {results?.[2] ? (
        <div className="absolute right-0 top-[84%] w-[210px] -translate-y-1/2">
          <ResultCard name={results[2].name} score={results[2].score} />
        </div>
      ) : null}
    </div>
  );
}

function MobileDiagram({ results }: { results: HeroResult[] | null }) {
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
        {results?.map((result, index) => (
          <ResultCard key={result.name} name={result.name} score={result.score} top={index === 0} />
        ))}
      </div>
    </div>
  );
}
