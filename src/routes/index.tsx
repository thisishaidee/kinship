// src/routes/index.tsx  (replaces the current landing page at "/")
//
// BEFORE PASTING: open the current src/routes/index.tsx and copy over anything this
// file does not have, especially a `head()` / meta block and any route options.
// This file only uses Tailwind arbitrary values, so it needs no theme changes.

import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { KinshipLogo } from "@/components/KinshipLogo";
import { getHeroResults, type HeroResult } from "@/lib/kinship-door";

export const Route = createFileRoute("/")({
  loader: () => getHeroResults(),
  component: Landing,
});

const SERIF = "'Instrument Serif', Georgia, serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";
const SANS = "'Space Grotesk', system-ui, sans-serif";

const GITHUB = "https://github.com/thisishaidee/kinship";

// ---------------------------------------------------------------------------
// Qloo rule: no Qloo response data in the public repo. The sample row and pitch are
// fetched at request time by getHeroResults (seed "Nike", same server proxy /app uses).
// If Qloo does not answer, the card is hidden. Nothing is hardcoded.
const SAMPLE_SEED = "Nike";
const COMPARE_SEEDS = ["Nike", "Adidas"];
const ROW_COLORS = ["#FFB548", "#8EF2C8", "#C8C3FA"];

const CHIPS = ["Radiohead", "Nike", "Drake"];

const STEPS = [
  {
    tag: "01 · ONE SEED",
    band: "bg-[#FFB548] text-[#1a1200]",
    title: "One seed.",
    text: "Type one name. Kinship looks it up on Qloo’s taste graph and shows the artists, brands and films its fans already love. You never have to invent a partner.",
  },
  {
    tag: "02 · REAL FANS",
    band: "bg-[#8EF2C8] text-[#0c231a]",
    title: "Real fans, not surveys.",
    text: "Every score comes from Qloo’s data on what real people listen to, watch and wear. Nobody ticked a box, so the numbers hold up in a pitch.",
  },
  {
    tag: "03 · READ WHY",
    band: "bg-[#C8C3FA] text-[#1b1830]",
    title: "You can read why.",
    text: "Compare two names and Kinship explains the match in plain sentences. You can repeat the reasoning out loud to anyone, no data science needed.",
  },
];

const CHECKS = [
  {
    title: "Only Qloo’s names",
    text: "A partner appears only if Qloo returned it, with its score.",
  },
  {
    title: "No match means no match",
    text: "If Qloo has no exact name, Kinship says so. It never swaps in a lookalike.",
  },
  {
    title: "Explanations are checked",
    text: "A sentence is shown only if it uses names and scores from the response.",
  },
];

const FOOTER_LINKS: [string, string][] = [
  ["Open app", "/app"],
  ["How it works", "#how"],
  ["Compare", "#compare"],
  ["Qloo attribution", "https://www.qloo.com"],
  ["GitHub repository", GITHUB],
  ["MIT license", `${GITHUB}/blob/main/LICENSE`],
];

function Landing() {
  const sample = Route.useLoaderData() as HeroResult[] | null;
  return (
    <div
      className="min-h-screen bg-[#0A0A0A] text-[#f4f1ea]"
      style={{ fontFamily: SANS }}
    >
      <Hero />
      {sample ? <SampleSection rows={sample} /> : null}
      <HowItWorks />
      <CompareSection rows={sample} />
      <TrustSection />
      <CtaBand />
      <Footer />
    </div>
  );
}


function QlooDiagram() {
  return (
    <div
      className="mx-auto mt-4 flex w-full max-w-[680px] items-center justify-between gap-2 rounded-2xl border border-[#2a2a30] bg-[#101014] px-4 py-4 md:mt-6 md:px-6"
      aria-hidden="true"
    >
      <div className="flex min-w-0 flex-col items-center gap-1.5">
        <span className="text-[10px] tracking-[0.8px] text-[#a3a09a] md:text-[11px]">ONE NAME</span>
        <span
          className="max-w-[110px] truncate text-lg md:text-xl"
          style={{ fontFamily: SERIF }}
        >
          Nike
        </span>
      </div>
      <span className="h-px min-w-4 flex-1 bg-[#2a2a30]" />
      <div className="flex flex-none flex-col items-center gap-1.5">
        <span className="text-[10px] tracking-[0.8px] text-[#a3a09a] md:text-[11px]">QLOO</span>
        <span
          className="inline-flex h-9 items-center rounded-full border border-[#FFB548] px-3 text-[13px] text-[#FFB548] md:h-10 md:text-sm"
        >
          taste graph
        </span>
      </div>
      <span className="h-px min-w-4 flex-1 bg-[#2a2a30]" />
      <div className="flex min-w-0 flex-col items-center gap-1.5">
        <span className="text-[10px] tracking-[0.8px] text-[#a3a09a] md:text-[11px]">PARTNERS</span>
        <div className="flex items-center gap-1.5">
          <span
            className="text-lg text-[#f4f1ea] md:text-xl"
            style={{ fontFamily: SERIF }}
          >
            Radiohead
          </span>
          <span className="text-sm font-semibold text-[#FFB548]" style={{ fontFamily: MONO }}>
            87
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="text-lg text-[#f4f1ea] md:text-xl"
            style={{ fontFamily: SERIF }}
          >
            Adidas
          </span>
          <span className="text-sm font-semibold text-[#a3a09a]" style={{ fontFamily: MONO }}>
            74
          </span>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden px-5 pb-10 md:px-16 md:pb-24">
      <header className="relative mx-auto flex h-[72px] max-w-[1152px] items-center justify-between">
        <a href="/" aria-label="Kinship home">
          <KinshipLogo size={28} />
        </a>
        <nav className="hidden gap-9 text-[15px] md:flex" aria-label="Main">
          <a className="text-[#cfcbc3] hover:text-white" href="#how">
            How it works
          </a>
          <a className="text-[#cfcbc3] hover:text-white" href="#compare">
            Compare
          </a>
          <a className="text-[#cfcbc3] hover:text-white" href={GITHUB}>
            GitHub
          </a>
        </nav>
        <a
          href="/app"
          className="inline-flex h-11 items-center rounded-full bg-[#f4f1ea] px-5 text-sm font-bold text-[#111]"
        >
          Launch app
        </a>
      </header>

      <div className="relative mx-auto mt-10 flex max-w-[1152px] flex-col items-center gap-[18px] text-center md:mt-16 md:gap-[22px]">
        <span className="inline-flex h-8 items-center gap-2 rounded-full border border-[#2a2a30] bg-[#101014] px-3.5 text-xs text-[#f4f1ea] md:h-[34px] md:text-[13px]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#FFB548]" />
          Powered by Qloo
        </span>

        <h1
          className="m-0 text-[54px] font-normal leading-[1.02] tracking-[-0.5px] md:text-[88px] md:tracking-[-1px]"
          style={{ fontFamily: SERIF }}
        >
          A partnership,<br />not a{" "}
          <span className="text-[#FFB548]">playlist.</span>
        </h1>

        <p className="m-0 max-w-[560px] text-base leading-normal text-[#b9b5ac] md:text-lg">
          Type an artist, film or brand. Kinship asks Qloo who its fans already love,
          then drafts the pitch.
        </p>

        {/* Plain GET form: opens /app?q=Nike. /app should read `q` (see HANDOFF.md). */}
        <form
          action="/app"
          method="get"
          className="flex w-full max-w-[680px] flex-col gap-2.5 md:h-16 md:flex-row md:items-center md:gap-2 md:rounded-full md:bg-[#f4f1ea] md:p-2 md:pl-6"
        >
          <label htmlFor="seed" className="sr-only">
            Artist, film or brand
          </label>
          <input
            id="seed"
            name="q"
            defaultValue={SAMPLE_SEED}
            autoComplete="off"
            className="h-14 w-full min-w-0 rounded-full bg-[#f4f1ea] px-6 text-[17px] text-[#111] outline-none md:h-12 md:flex-1 md:bg-transparent md:px-0 md:text-lg"
          />
          <button
            type="submit"
            className="h-14 rounded-full bg-[#FFB548] px-7 text-base font-bold text-[#1a1200] md:h-12"
          >
            Find partners
          </button>
        </form>

        <div className="flex flex-wrap justify-center gap-2 md:gap-2.5">
          {CHIPS.map((name) => (
            <a
              key={name}
              href={`/app?q=${encodeURIComponent(name)}`}
              className={
                name === SAMPLE_SEED
                  ? "inline-flex h-11 items-center rounded-full border border-[#FFB548] bg-[#101014] px-4 text-sm text-[#FFB548] md:px-[18px]"
                  : "inline-flex h-11 items-center rounded-full border border-[#2e2e34] px-4 text-sm text-[#f4f1ea] md:px-[18px]"
              }
            >
              {name}
            </a>
          ))}
        </div>

        <QlooDiagram />
      </div>
    </section>
  );
}

function CopyPitch({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* clipboard blocked: do nothing */
        }
      }}
      className="h-12 flex-1 rounded-full bg-[#f4f1ea] text-[15px] font-bold text-[#111]"
    >
      {copied ? "Copied" : "Copy pitch"}
    </button>
  );
}

function SampleSection({ rows }: { rows: HeroResult[] }) {
  const pitch = `${SAMPLE_SEED} could explore an artist partnership with ${rows[0].name} (${rows[0].score}) and ${rows[1].name} (${rows[1].score}).`;
  return (
    <section className="px-5 md:px-16">
      <div className="mx-auto max-w-[1152px] rounded-3xl border border-[#2a2a30] bg-[#101014] p-4 lg:grid lg:grid-cols-3 lg:gap-4 lg:p-5">
        {rows.slice(0, 3).map((r, i) => (
          <div
            key={r.name}
            className="mb-4 rounded-[18px] bg-[#0d0d11] p-5 md:mb-0 md:p-6"
          >
            <div className="text-[11px] tracking-[0.8px] text-[#a3a09a]">
              QLOO AFFINITY
            </div>
            <div
              className="mt-2 min-w-0 break-words text-[22px] leading-[1.1] text-[#f4f1ea]"
              style={{ fontFamily: SERIF }}
            >
              {r.name}
            </div>
            <div
              className="mt-3 text-[34px] font-semibold leading-none"
              style={{ fontFamily: MONO, color: ROW_COLORS[i % ROW_COLORS.length] }}
            >
              {r.score}
            </div>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-4 max-w-[1152px] md:hidden">
        <p className="m-0 text-sm leading-normal text-[#cfcbc3]">{pitch}</p>
        <div className="mt-3 flex gap-2.5">
          <CopyPitch text={pitch} />
          <a
            href="/app"
            className="inline-flex h-12 flex-1 items-center justify-center rounded-full border border-[#2e2e34] text-[15px] text-[#f4f1ea]"
          >
            Try your own
          </a>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section
      id="how"
      className="mt-14 rounded-t-[28px] bg-[#F3F0EA] px-5 py-12 text-[#141413] md:mt-24 md:rounded-t-[32px] md:px-16 md:py-20"
    >
      <div className="mx-auto max-w-[1152px]">
        <span className="text-xs tracking-[0.8px] text-[#6b6963]">HOW IT WORKS</span>
        <h2
          className="mb-5 mt-2 text-[40px] font-normal leading-[1.05] md:mb-10 md:text-[52px]"
          style={{ fontFamily: SERIF }}
        >
          Three steps, no guessing.
        </h2>
        <div className="grid gap-5 lg:grid-cols-3 lg:gap-6">
          {STEPS.map((s) => (
            <div
              key={s.tag}
              className="overflow-hidden rounded-[20px] bg-white md:rounded-[22px]"
            >
              <div className={`px-5 py-3 text-xs font-bold tracking-[0.6px] ${s.band}`}>
                {s.tag}
              </div>
              <div className="p-5 md:p-6">
                <div className="text-[24px] leading-tight text-[#141413]" style={{ fontFamily: SERIF }}>
                  {s.title}
                </div>
                <p className="m-0 mt-2 text-[15px] leading-[1.55] text-[#4a4944]">{s.text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CompareSection({ rows }: { rows: HeroResult[] | null }) {
  const top = rows && rows.length > 0 ? rows[0] : null;
  return (
    <section
      id="compare"
      className="mx-auto flex max-w-[1152px] flex-col gap-8 px-5 py-12 lg:flex-row lg:items-center lg:gap-16 lg:px-16 lg:py-24"
    >
      <div className="flex flex-col gap-4 md:flex-1">
        <span className="text-xs tracking-[0.8px] text-[#FFB548]">FROM AFFINITY TO PITCH</span>
        <h2
          className="m-0 text-[40px] font-normal leading-[1.05] md:text-[52px]"
          style={{ fontFamily: SERIF }}
        >
          Hand a partner the proof, not a hunch.
        </h2>
        <p className="m-0 max-w-[480px] text-[16px] leading-[1.55] text-[#b9b5ac]">
          Compare two names and Kinship lists what their fans share, then explains it in
          two sentences you can repeat out loud. Export it as a one-page PDF.
        </p>
        <a
          href="/app"
          className="mt-2 inline-flex h-12 items-center justify-center self-start rounded-full bg-[#FFB548] px-6 text-[15px] font-bold text-[#1a1200]"
        >
          Open the app
        </a>
      </div>

      {top ? (
        <div className="rounded-[22px] border border-[#2a2a30] bg-[#101014] p-6 lg:w-[440px] lg:flex-none md:p-7">
          <div
            className="text-[24px] text-[#f4f1ea]"
            style={{ fontFamily: SERIF }}
          >
            {SAMPLE_SEED} × {top.name}
          </div>
          <div
            className="mt-3 text-[40px] font-semibold leading-none text-[#FFB548]"
            style={{ fontFamily: MONO }}
          >
            {top.score}
          </div>
          <p className="m-0 mt-4 text-sm leading-[1.55] text-[#cfcbc3]">
            {SAMPLE_SEED} and {top.name} share a strong audience overlap in Qloo’s
            data. The {top.score} affinity suggests the two already reach the same
            fans.
          </p>
          <div className="mt-4 flex items-center gap-2 text-xs text-[#a3a09a]">
            <span className="h-1.5 w-1.5 flex-none rounded-full bg-[#7fe3b3]" />
            Checked against Qloo’s response
          </div>
        </div>
      ) : (
        <div className="rounded-[22px] border border-[#2a2a30] bg-[#101014] p-6 lg:w-[440px] lg:flex-none md:p-7">
          <div className="flex justify-between pb-2.5 text-xs tracking-[0.8px] text-[#a3a09a]">
            <span>
              {COMPARE_SEEDS[0].toUpperCase()} × {COMPARE_SEEDS[1].toUpperCase()}
            </span>
          </div>
          <p className="m-0 border-t border-[#2a2a30] pt-3 text-sm leading-normal text-[#cfcbc3]">
            Pick two names. Kinship lists what their fans share and writes the explanation.
          </p>
          <a
            href="/app?mode=compare"
            className="mt-3.5 inline-flex h-[52px] w-full items-center justify-center rounded-full bg-[#FFB548] text-[15px] font-bold text-[#1a1200]"
          >
            Try Compare
          </a>
        </div>
      )}
    </section>
  );
}

function TrustSection() {
  return (
    <section className="mx-auto max-w-[1152px] px-5 pb-12 md:px-16 md:pb-20">
      <span className="text-xs tracking-[0.8px] text-[#a3a09a]">BUILT TO BE CHECKED</span>
      <div className="mt-4 grid gap-4 lg:grid-cols-3 lg:gap-12">
        {CHECKS.map((c) => (
          <div key={c.title} className="flex gap-3">
            <span className="mt-2 h-2 w-2 flex-none rounded-full bg-[#FFB548]" />
            <div>
              <div className="text-lg font-medium">{c.title}</div>
              <div className="mt-0.5 text-sm leading-normal text-[#a3a09a]">{c.text}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CtaBand() {
  return (
    <section className="border-t border-[#2a2a30] px-5 py-11 text-[#f4f1ea] md:px-16 md:py-[72px]">
      <div className="mx-auto flex max-w-[1152px] flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <span
          className="text-[46px] leading-[1.02] md:max-w-[640px] md:text-[64px]"
          style={{ fontFamily: SERIF }}
        >
          Try it on a name you know.
        </span>
        <a
          href="/app"
          className="inline-flex h-14 items-center justify-center rounded-full bg-[#FFB548] px-8 text-base font-bold text-[#1a1200]"
        >
          Launch app
        </a>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="mx-auto flex max-w-[1152px] flex-col gap-6 px-5 pb-8 pt-10 md:px-16 md:pt-14">
      <div className="flex flex-col gap-6 lg:flex-row lg:justify-between">
        <div>
          <KinshipLogo size={26} />
          <div className="mt-1 text-sm text-[#a3a09a]">Partner discovery from shared fans.</div>
        </div>
        <div className="grid grid-cols-2 gap-x-4 text-[15px] lg:grid-cols-3 lg:gap-x-16">
          {FOOTER_LINKS.map(([label, href]) => (
            <a key={label} href={href} className="flex h-11 items-center text-[#cfcbc3] hover:text-white">
              {label}
            </a>
          ))}
        </div>
      </div>
      <p className="m-0 border-t border-[#26262c] pt-4 text-xs leading-normal text-[#a3a09a]">
        Scores come from Qloo’s taste graph and show a connection in the data, not
        partnership availability. Beta: scores are estimates. © 2026 Kinship
      </p>
    </footer>
  );
}
