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
const ROW_COLORS = ["#E0202C", "#f4f1ea", "#a3a09a"];

const CHIPS = ["Radiohead", "Nike", "Davido"];

const STEPS = [
  {
    tag: "01 · ONE NAME",
    bg: "bg-[#E0202C]",
    fg: "text-[#f4f1ea]",
    text: "Type one name. Kinship looks it up on Qloo and lists the artists, brands and films its fans already love.",
  },
  {
    tag: "02 · REAL DATA",
    bg: "bg-[#8ff0c4]",
    fg: "text-[#06241a]",
    text: "Every name and score comes from Qloo’s data on what people listen to, watch and wear. Nothing is invented.",
  },
  {
    tag: "03 · READ WHY",
    bg: "bg-[#c9c4ff]",
    fg: "text-[#1a1647]",
    text: "Compare two names and Kinship explains the match in plain sentences you can repeat out loud.",
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
      <CompareSection />
      <TrustSection />
      <CtaBand />
      <Footer />
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
        <span className="inline-flex h-8 items-center gap-2 rounded-full border border-[#3a2f22] bg-[#14100b] px-3.5 text-xs text-[#ffcf8a] md:h-[34px] md:text-[13px]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#E0202C]" />
          Powered by Qloo
        </span>

        <h1
          className="m-0 text-[54px] font-normal leading-none tracking-[-0.5px] md:text-[88px] md:tracking-[-1px]"
          style={{ fontFamily: SERIF }}
        >
          A partnership, not a <span className="text-[#E0202C]">playlist.</span>
        </h1>

        <p className="m-0 max-w-[560px] text-base leading-normal text-[#b9b5ac] md:text-lg">
          Type an artist, film or brand. Kinship finds the partners its fans already
          love on Qloo, then drafts the pitch.
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
            className="h-14 rounded-full bg-[#E0202C] px-7 text-base font-bold text-[#f4f1ea] md:h-12"
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
                  ? "inline-flex h-11 items-center rounded-full border border-[#E0202C] bg-[#101014] px-4 text-sm text-[#E0202C] md:px-[18px]"
                  : "inline-flex h-11 items-center rounded-full border border-[#2e2e34] px-4 text-sm text-[#f4f1ea] md:px-[18px]"
              }
            >
              {name}
            </a>
          ))}
        </div>
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
      <div className="mx-auto max-w-[560px] rounded-3xl border border-[#2a2a30] bg-[#101014] p-5 md:p-7">
        <div className="flex items-baseline justify-between pb-3">
          <span className="text-[13px] tracking-[0.8px] text-[#ffcf8a]">
            {SAMPLE_SEED.toUpperCase()} · STRONGEST MATCHES
          </span>
          <span className="text-xs text-[#a3a09a]">Sample</span>
        </div>

        {rows.map((r, i) => (
          <div
            key={r.name}
            className="flex items-center gap-3 border-t border-[#26262c] py-3.5"
          >
            <div className="min-w-0 flex-1">
              <div className="break-words text-[26px] leading-[1.1]" style={{ fontFamily: SERIF }}>
                {r.name}
              </div>
            </div>
            <span
              className="flex-none text-[30px] font-semibold"
              style={{ fontFamily: MONO, color: ROW_COLORS[i] }}
            >
              {r.score}
            </span>
          </div>
        ))}

        <p className="m-0 border-t border-[#26262c] pt-3.5 text-sm leading-normal text-[#cfcbc3]">
          {pitch}
        </p>
        <div className="mt-3.5 flex gap-2.5">
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
      className="mt-14 rounded-t-[28px] bg-[#efeee9] px-5 py-12 text-[#141413] md:mt-24 md:rounded-t-[32px] md:px-16 md:py-20"
    >
      <div className="mx-auto max-w-[1152px]">
        <span className="text-xs tracking-[0.8px] text-[#5f5d57]">HOW IT WORKS</span>
        <h2
          className="mb-5 mt-2 text-[40px] font-normal leading-[1.05] md:mb-10 md:text-[52px]"
          style={{ fontFamily: SERIF }}
        >
          Three steps, no guessing.
        </h2>
        <div className="grid gap-5 md:grid-cols-3 md:gap-6">
          {STEPS.map((s) => (
            <div key={s.tag} className="overflow-hidden rounded-[20px] bg-white md:rounded-[22px]">
              <div className={`px-5 py-3 text-xs font-bold tracking-[0.6px] ${s.bg} ${s.fg}`}>
                {s.tag}
              </div>
              <p className="m-0 p-5 text-[15px] leading-[1.55] text-[#4a4944] md:p-6">{s.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CompareSection() {
  return (
    <section
      id="compare"
      className="mx-auto flex max-w-[1152px] flex-col gap-5 px-5 py-12 md:flex-row md:items-center md:gap-16 md:px-16 md:py-24"
    >
      <div className="flex flex-col gap-4 md:flex-1">
        <span className="text-xs tracking-[0.8px] text-[#ffcf8a]">COMPARE</span>
        <h2
          className="m-0 text-[40px] font-normal leading-[1.05] md:text-[56px]"
          style={{ fontFamily: SERIF }}
        >
          Hand a partner the proof, not a hunch.
        </h2>
        <p className="m-0 hidden max-w-[480px] text-[17px] leading-[1.55] text-[#b9b5ac] md:block">
          Compare two names and Kinship lists what their fans share, then explains it in
          two sentences you can repeat out loud. Export it as a one-page PDF.
        </p>
      </div>

      <div className="rounded-[22px] border border-[#2a2a30] bg-[#101014] p-5 md:w-[500px] md:flex-none md:p-7">
        <div className="flex justify-between pb-2.5 text-xs tracking-[0.8px] text-[#a3a09a]">
          <span>
            {COMPARE_SEEDS[0].toUpperCase()} × {COMPARE_SEEDS[1].toUpperCase()}
          </span>
          <span className="flex gap-[18px]">
            <span>{COMPARE_SEEDS[0].toUpperCase()}</span>
            <span>{COMPARE_SEEDS[1].toUpperCase()}</span>
          </span>
        </div>
        <p className="m-0 border-t border-[#2a2a30] pt-3 text-sm leading-normal text-[#cfcbc3]">
          Pick two names. Kinship lists what their fans share and writes the explanation.
        </p>
        <a
          href="/app"
          className="mt-3.5 inline-flex h-[52px] w-full items-center justify-center rounded-full bg-[#E0202C] text-[15px] font-bold text-[#f4f1ea]"
        >
          Try Compare
        </a>
      </div>
    </section>
  );
}

function TrustSection() {
  return (
    <section className="mx-auto max-w-[1152px] px-5 pb-12 md:px-16 md:pb-20">
      <span className="text-xs tracking-[0.8px] text-[#a3a09a]">BUILT TO BE CHECKED</span>
      <div className="mt-4 grid gap-4 md:grid-cols-3 md:gap-12">
        {CHECKS.map((c) => (
          <div key={c.title} className="flex gap-3">
            <span className="mt-2 h-2 w-2 flex-none rounded-full bg-[#7fe3b3]" />
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
    <section className="bg-[#E0202C] px-5 py-11 text-[#f4f1ea] md:px-16 md:py-[72px]">
      <div className="mx-auto flex max-w-[1152px] flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <span
          className="text-[46px] leading-[1.02] md:max-w-[640px] md:text-[64px]"
          style={{ fontFamily: SERIF }}
        >
          Try it on a name you know.
        </span>
        <a
          href="/app"
          className="inline-flex h-14 items-center justify-center rounded-full bg-[#0b0b12] px-8 text-base font-bold text-white"
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
      <div className="flex flex-col gap-6 md:flex-row md:justify-between">
        <div>
          <KinshipLogo size={26} />
          <div className="mt-1 text-sm text-[#a3a09a]">Partner discovery from shared fans.</div>
        </div>
        <div className="grid grid-cols-2 gap-x-4 text-[15px] md:grid-cols-3 md:gap-x-16">
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
