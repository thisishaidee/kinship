import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState, type FormEvent, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import { ArrowRight, Check, Copy, Download, Loader2, Search } from "lucide-react";
import {
  compareKinshipSeeds,
  copyFailureMessage,
  formatAffinity,
  isLatestRequest,
  partnerSearchHref,
  resolveKinshipSeed,
  runAgenticPitch,
  type Candidate,
  type CompareResult,
  type GraphStatus,
  type Pitch,
  type ResolvedEntity,
  type UncheckedCategory,
} from "@/lib/kinship-door";
import { KinshipLogo } from "@/components/KinshipLogo";
import { PDF_FILENAME, buildPairingPdf, pdfBlob, preparePdfAnchor } from "@/lib/kinship-pdf";
import type { AgentStep } from "@/lib/kinship-agent";

// Set once per page load; a module-level flag survives client-side navigations back to /app.
let nikeAutoRanThisLoad = false;

export const Route = createFileRoute("/app")({
  validateSearch: (search: Record<string, unknown>): { q?: string; mode?: "compare" } => {
    const mode = search.mode === "compare" ? ("compare" as const) : undefined;
    // ?q= is canonical (landing form and chips). ?try= is a legacy alias, read only, never written.
    if (typeof search.q === "string") return { q: search.q, mode };
    if (typeof search.try === "string") return { q: search.try, mode };
    return { mode };
  },
  component: Home,
});

const EXAMPLES = ["Radiohead", "Nike", "Drake"] as const;
const RESULT_NOTE = "This shows who their fans overlap with — not whether a deal will happen.";

type Phase = "idle" | "loading" | "matched" | "ambiguous" | "no-match" | "missing-key" | "refused" | "unavailable";
type Mode = "single" | "compare";
type CompareMatch = Extract<CompareResult, { status: "matched" }>;

function problemCopy(reason: "empty" | "too-long" | "invalid"): string {
  if (reason === "too-long") return "That name is too long. Use 120 characters or fewer.";
  return "Enter an artist, film, or brand.";
}

function Home() {
  const { q: queryName, mode: modeParam } = Route.useSearch();
  const resolveSeed = useServerFn(resolveKinshipSeed);
  const compareSeeds = useServerFn(compareKinshipSeeds);
  const requestSeq = useRef(0);
  const picks = useRef<{ left?: string; right?: string }>({});
  const [mode, setMode] = useState<Mode>("single");
  const [seed, setSeed] = useState("");
  const [leftSeed, setLeftSeed] = useState("");
  const [rightSeed, setRightSeed] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [heldSeed, setHeldSeed] = useState("");
  const [match, setMatch] = useState<ResolvedEntity | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candidatesExact, setCandidatesExact] = useState(true);
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [unchecked, setUnchecked] = useState<UncheckedCategory[]>([]);
  const [graphStatus, setGraphStatus] = useState<GraphStatus>("empty");
  const [error, setError] = useState("");
  const [comparePhase, setComparePhase] = useState<Phase>("idle");
  const [compareError, setCompareError] = useState("");
  const [leftCandidates, setLeftCandidates] = useState<Candidate[]>([]);
  const [rightCandidates, setRightCandidates] = useState<Candidate[]>([]);
  const [leftExact, setLeftExact] = useState(true);
  const [rightExact, setRightExact] = useState(true);
  const [pairing, setPairing] = useState<CompareMatch | null>(null);
  const [agentSteps, setAgentSteps] = useState<AgentStep[]>([]);
  const [agentPitched, setAgentPitched] = useState(false);
  const [openPitch, setOpenPitch] = useState<{ seed: string; seedType: string; partner: string; partnerType: string; score: number; line: string } | null>(null);
  const [agentReason, setAgentReason] = useState<string | null>(null);
  const runAgent = useServerFn(runAgenticPitch);

  async function run(next: string, entityId?: string) {
    if (!next) {
      setError(problemCopy("empty"));
      return;
    }
    const requestId = ++requestSeq.current;
    setError("");
    setMatch(null);
    setCandidates([]);
    setPitches([]);
    setUnchecked([]);
    setGraphStatus("empty");
    setAgentSteps([]);
    setAgentPitched(false);
    setAgentReason(null);
    setPhase("loading");
    try {
      const result = await resolveSeed({ data: { seed: next, entityId } });
      if (!isLatestRequest(requestId, requestSeq.current)) return;
      if (result.status === "bad-seed") {
        setPhase("idle");
        setError(problemCopy(result.reason));
        return;
      }
      setHeldSeed(result.seed);
      if (result.status === "ambiguous") {
        setCandidates(result.candidates);
        setCandidatesExact(result.exact);
        setPhase("ambiguous");
        return;
      }
      if (result.status === "matched") {
        setMatch(result.entity);
        setPitches(result.pitches);
        setUnchecked(result.unchecked);
        setGraphStatus(result.graphStatus);
        setPhase("matched");
        void runAgent({ data: { seed: next, entityId } }).then((agent) => {
          if (!isLatestRequest(requestId, requestSeq.current)) return;
          if (agent) {
            setAgentSteps(agent.steps);
            setAgentPitched(agent.status === "pitch");
            setAgentReason(agent.status === "fallback" ? agentReasonCopy(agent.reason) : null);
          }
        }).catch(() => undefined);
        return;
      }
      if (result.status === "unavailable") {
        setMatch(result.entity ?? null);
        setUnchecked(result.unchecked);
        setPhase("unavailable");
        return;
      }
      setPhase(result.status);
    } catch {
      if (!isLatestRequest(requestId, requestSeq.current)) return;
      setPhase("unavailable");
      setHeldSeed(next);
    }
  }

  async function runCompare(options?: { left?: string; right?: string; leftId?: string; rightId?: string }) {
    const left = (options?.left ?? leftSeed).trim();
    const right = (options?.right ?? rightSeed).trim();
    const leftId = options?.leftId;
    const rightId = options?.rightId;
    if (!left || !right) {
      setCompareError("Enter both names.");
      return;
    }
    const requestId = ++requestSeq.current;
    setCompareError("");
    setPairing(null);
    setLeftCandidates([]);
    setRightCandidates([]);
    if (!leftId && !rightId) picks.current = {};
    setComparePhase("loading");
    try {
      const result = await compareSeeds({ data: { left, right, leftId, rightId } });
      if (!isLatestRequest(requestId, requestSeq.current)) return;
      if (result.status === "bad-seed") {
        setComparePhase("idle");
        setCompareError(problemCopy(result.reason));
        return;
      }
      if (result.status === "ambiguous") {
        setLeftCandidates(result.leftCandidates ?? []);
        setRightCandidates(result.rightCandidates ?? []);
        setLeftExact(result.leftExact);
        setRightExact(result.rightExact);
        setComparePhase("ambiguous");
        return;
      }
      if (result.status === "matched") {
        setPairing(result);
        setComparePhase("matched");
        return;
      }
      if (result.status === "no-match") {
        const which = result.side === "both" ? "either name" : result.side === "left" ? left : right;
        setCompareError(`No exact Qloo match for ${which}. Kinship will not use a similar name.`);
        setComparePhase("no-match");
        return;
      }
      setComparePhase(result.status === "missing-key" ? "missing-key" : result.status === "refused" ? "refused" : "unavailable");
    } catch {
      if (!isLatestRequest(requestId, requestSeq.current)) return;
      setComparePhase("unavailable");
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (mode === "single") {
      const field = form.elements.namedItem("seed");
      const next = field instanceof HTMLInputElement ? field.value : seed;
      setSeed(next);
      void run(next.trim());
      return;
    }
    const leftField = form.elements.namedItem("left-seed");
    const rightField = form.elements.namedItem("right-seed");
    const left = leftField instanceof HTMLInputElement ? leftField.value : leftSeed;
    const right = rightField instanceof HTMLInputElement ? rightField.value : rightSeed;
    setLeftSeed(left);
    setRightSeed(right);
    void runCompare({ left, right });
  }

  const busy = mode === "single" ? phase === "loading" : comparePhase === "loading";

  useEffect(() => {
    if (modeParam === "compare") setMode("compare");
  }, [modeParam]);

  const queryRan = useRef(false);
  useEffect(() => {
    if (!queryName || queryRan.current) return;
    queryRan.current = true;
    setSeed(queryName);
    void run(queryName.trim());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryName]);

  // /app with no query runs the Nike seed once per page load, so the page is never empty.
  // The module-level flag stops it from re-running on later navigations back to /app.
  useEffect(() => {
    if (queryName || modeParam === "compare" || nikeAutoRanThisLoad) return;
    nikeAutoRanThisLoad = true;
    setSeed("Nike");
    void run("Nike");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex w-full flex-col overflow-x-hidden bg-bg">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-5">
          <a href="/" aria-label="Kinship home" className="shrink-0">
            <KinshipLogo size={26} />
          </a>
        </div>
      </header>
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-5 pb-8 pt-6 sm:pt-8">
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-4xl leading-none text-white sm:text-[44px]">
          A partnership, <span className="italic text-accent">not a playlist.</span>
        </h1>
        <p className="text-base text-muted">
          {mode === "single"
            ? "Type an artist, film, or brand. Kinship checks who their fans already love."
            : "Compare two exact Qloo entities. A shared name appears only when both results use the same entity."}
        </p>
      </header>

      <HowItWorks />

      <div className="grid grid-cols-2 gap-2">
        <button type="button" aria-pressed={mode === "single"} onClick={() => setMode("single")} className={modeButton(mode === "single")}>
          one name
        </button>
        <button type="button" aria-pressed={mode === "compare"} onClick={() => setMode("compare")} className={modeButton(mode === "compare")}>
          Compare
        </button>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        {mode === "single" ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="seed" className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">
              Artist, film or brand
            </label>
          <div className="flex min-w-0 items-center gap-2 rounded-full border border-line bg-surface py-1.5 pl-5 pr-1.5 focus-within:border-accent">
            <label htmlFor="seed" className="sr-only">
              Name
            </label>
            <input
              id="seed"
              name="seed"
              value={seed}
              onChange={(event) => {
                setSeed(event.target.value);
                if (error) setError("");
              }}
              onInput={(event) => {
                setSeed(event.currentTarget.value);
                if (error) setError("");
              }}
              placeholder="Artist, film, or brand"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="search"
              className="h-10 min-w-0 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-muted"
            />
            <SubmitButton busy={busy} label={busy ? "Asking Qloo" : "Find partners"} inline />
          </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SeedField id="left-seed" label="First" value={leftSeed} onChange={setLeftSeed} />
            <SeedField id="right-seed" label="Second" value={rightSeed} onChange={setRightSeed} />
          </div>
        )}
        {mode === "single" && error ? (
          <p className="text-sm text-accent" role="alert">
            {error}
          </p>
        ) : null}
        {mode === "compare" && compareError ? (
          <p className="text-sm text-accent" role="alert">
            {compareError}
          </p>
        ) : null}
        {shownPhase(mode, phase, comparePhase) === "missing-key" ? <Alert>The Qloo key is not on the server. This page cannot hold it.</Alert> : null}
        {shownPhase(mode, phase, comparePhase) === "refused" ? <Alert>Qloo refused the server key.</Alert> : null}
        {mode === "single" && phase === "unavailable" && !match ? <Alert>Qloo did not answer. Try again.</Alert> : null}
        {mode === "compare" && comparePhase === "unavailable" ? <Alert>Qloo did not answer. Try again.</Alert> : null}
        {mode === "single" && phase === "no-match" ? (
          <Alert>No exact Qloo match for “{heldSeed}”. Kinship will not use a similar name.</Alert>
        ) : null}
        {busy ? <LoadingSteps mode={mode} /> : null}
        {mode === "compare" ? <SubmitButton busy={busy} label={busy ? "Asking Qloo" : "Compare"} /> : null}
      </form>

      {mode === "single" && phase === "idle" ? (
        <section className="flex flex-col gap-3">
          <p className="rounded-2xl border border-[#242424] bg-[#161616] px-4 py-3 text-sm text-muted">
            How it works: type a name, we check who its fans already love on Qloo, and you get partners with proof. Scores near 1.0 mean the strongest fan overlap.
          </p>
          <h2 className="text-sm font-medium text-fg">No pitch yet</h2>
          <p className="text-base text-muted">The field starts empty. Pick a name, or type your own.</p>
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => {
                  setSeed(example);
                  void run(example);
                }}
                className="inline-flex h-10 items-center rounded-full border border-line bg-surface px-4 text-sm font-medium text-fg hover:border-accent"
              >
                {example}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {mode === "single" && match ? (
        <section className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-5 shadow-card">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">Resolved on Qloo</p>
          <p className="font-sans text-2xl font-semibold leading-tight text-white">{match.name}</p>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-accent">{match.typeLabel}</p>
        </section>
      ) : null}

      {mode === "single" && phase === "ambiguous" ? (
        <Chooser
          title={candidatesExact ? `More than one Qloo entity matches “${heldSeed}”.` : `No exact Qloo match for “${heldSeed}”. Closest Qloo results, pick one:`}
          candidates={candidates}
          busy={busy}
          onPick={(id) => void run(heldSeed, id)}
        />
      ) : null}

      {openPitch && mode === "single" && phase === "matched" ? (
        <PitchDetail
          data={openPitch}
          onBack={() => setOpenPitch(null)}
        />
      ) : openPitch && mode === "single" && phase !== "matched" ? null : mode === "single" && (phase === "matched" || (phase === "unavailable" && match)) ? (
        <section className="flex flex-col gap-3" aria-busy={busy} aria-live="polite">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">{match?.name ?? heldSeed} · strongest matches</h2>
          </div>
          {phase === "matched" && pitches.length === 0 ? (
            <p className="text-base text-muted">
              {graphStatus === "partial"
                ? `Qloo resolved ${match?.name ?? "the name"}, but the categories that answered had no score.`
                : `Qloo resolved ${match?.name ?? "the name"}, but no category came back with a score.`}
            </p>
          ) : null}
          {phase === "unavailable" && match ? (
            <p className="text-base text-muted">Qloo resolved {match.name}, but the categories could not be checked.</p>
          ) : null}
          {phase === "matched" && (agentSteps.length > 0 || agentReason) ? <AgentTrace steps={agentSteps} pitched={agentPitched} reason={agentReason} /> : null}
          {phase === "matched" && pitches.length > 0 ? (
            <div className="flex flex-col gap-12">
              {pitches.map((pitch) => (
                <section key={pitch.id} className="flex flex-col gap-5">
                  <ul className="grid grid-cols-1 gap-5 md:grid-cols-2">
                    {pitch.hits.map((hit, hitIndex) => (
                      <li
                        key={hit.entityId}
                        className={hitIndex === pitch.hits.length - 1 && pitch.hits.length % 2 === 1 ? "md:col-span-2" : undefined}
                      >
                        <ResultCard
                          name={hit.name}
                          href={partnerSearchHref(match?.name ?? heldSeed, hit.name)}
                          category={pitch.partnerType}
                          score={hit.score}
                          top={hitIndex === 0}
                          seed={match?.name ?? heldSeed}
                          line={hitIndex === 0 ? pitch.line : null}
                          onOpen={() => setOpenPitch({
                            seed: match?.name ?? heldSeed,
                            seedType: match?.typeLabel ?? "",
                            partner: hit.name,
                            partnerType: pitch.partnerType,
                            score: hit.score,
                            line: pitch.line || `${match?.name ?? heldSeed} and ${hit.name} share a strong audience overlap in Qloo’s data.`,
                          })}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          ) : null}
          {unchecked.map((category) => (
            <p key={category.id} className="text-sm text-accent" role="status">
              {category.line}
            </p>
          ))}
          {phase === "matched" && pitches.length > 0 && unchecked.length === 0 ? (
            <p className="text-sm leading-snug text-muted">{RESULT_NOTE}</p>
          ) : null}
        </section>
      ) : null}

      {mode === "compare" && comparePhase === "ambiguous" ? (
        <div className="flex flex-col gap-6">
          {leftCandidates.length > 0 ? (
            <Chooser
              title={leftExact ? `More than one Qloo entity matches “${leftSeed.trim()}”.` : `No exact Qloo match for “${leftSeed.trim()}”. Closest Qloo results, pick one:`}
              candidates={leftCandidates}
              busy={busy}
              onPick={(id) => {
                picks.current.left = id;
                void runCompare({ leftId: id, rightId: picks.current.right });
              }}
            />
          ) : null}
          {rightCandidates.length > 0 ? (
            <Chooser
              title={rightExact ? `More than one Qloo entity matches “${rightSeed.trim()}”.` : `No exact Qloo match for “${rightSeed.trim()}”. Closest Qloo results, pick one:`}
              candidates={rightCandidates}
              busy={busy}
              onPick={(id) => {
                picks.current.right = id;
                void runCompare({ leftId: picks.current.left, rightId: id });
              }}
            />
          ) : null}
        </div>
      ) : null}

      {mode === "compare" && pairing ? <CompareView pairing={pairing} /> : null}

      <footer className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-line pt-5 text-sm text-muted sm:mt-8">
        <a href="https://github.com/thisishaidee/kinship" target="_blank" rel="noopener noreferrer" className="text-fg underline decoration-1 underline-offset-4">
          GitHub repository
        </a>
        <a href="https://github.com/thisishaidee/kinship/blob/main/LICENSE" target="_blank" rel="noopener noreferrer" className="text-fg underline decoration-1 underline-offset-4">
          MIT license
        </a>
      </footer>
    </main>
    </div>
  );
}

function HowItWorks() {
  const steps = ["type a name", "qloo finds shared fans", "get your partners, compare, export"];
  return (
    <section className="flex flex-col gap-3" aria-labelledby="how-it-works">
      <h2 id="how-it-works" className="text-sm font-medium text-fg">
        How it works
      </h2>
      <p className="text-sm leading-snug text-muted">
        Every name and score comes straight from Qloo.
      </p>
      <div className="flex flex-col">
        {steps.map((step) => (
          <p key={step} className="border-t border-white/10 py-4 text-sm text-fg first:border-t-0 first:pt-0">
            {step}
          </p>
        ))}
      </div>
    </section>
  );
}

function agentReasonCopy(reason: string): string {
  if (reason === "not-configured") return "the ai writer is not turned on here, so the cards use the standard read.";
  if (reason === "model-error" || reason === "agent-error") return "the ai writer could not be reached right now, so the cards use the standard read.";
  if (reason === "invalid-output") return "the ai writer's answer did not pass the check, so the cards use the standard read.";
  if (reason === "no-evidence") return "the ai writer found no shared partners to write from, so the cards use the standard read.";
  if (reason === "budget" || reason === "still-calling") return "the ai writer ran out of lookups before it finished, so the cards use the standard read.";
  return "the ai writer did not finish, so the cards use the standard read.";
}

function AgentTrace({ steps, pitched, reason }: { steps: AgentStep[]; pitched: boolean; reason: string | null }) {
  return (
    <details className="flex flex-col gap-2 border-t border-line pt-3 text-sm text-muted">
      <summary className="cursor-pointer text-muted">how the agent worked</summary>
      {pitched ? null : <p className="mt-2 text-muted">{reason ?? "the agent did not finish a checked pitch, so the cards below use the standard read."}</p>}
      <ol className="mt-2 flex flex-col gap-1">
        {steps.map((step, index) => (
          <li key={index} className={step.ok ? "text-muted" : "text-muted line-through"}>
            {step.label}
          </li>
        ))}
      </ol>
    </details>
  );
}

function LoadingSteps({ mode }: { mode: Mode }) {
  const steps =
    mode === "compare"
      ? ["resolving both names", "reading Qloo’s data", "building the compare"]
      : ["resolving the name", "reading Qloo’s data", "building your pitch"];
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setStep((current) => (current + 1 >= steps.length ? current : current + 1)), 1600);
    return () => window.clearInterval(id);
  }, [steps.length]);
  return (
    <div className="border-l-[3px] border-l-accent flex flex-col gap-3 rounded-xl border border-line bg-surface px-4 py-3 shadow-card" role="status" aria-live="polite">
      <ol className="flex flex-col gap-1">
        {steps.map((label, index) => (
          <li key={label} className={index === step ? "text-sm text-white" : "text-sm text-muted"}>
            {label}
            {index === step ? "…" : ""}
          </li>
        ))}
      </ol>
      <div className="flex flex-col gap-2" aria-hidden="true">
        {[0, 1].map((slot) => (
          <div key={slot} className="h-16 animate-pulse rounded-2xl border border-line bg-surface" />
        ))}
      </div>
    </div>
  );
}

function choiceLine(candidate: Candidate): string {
  const detail = candidate.detail?.trim();
  if (!detail) return candidate.typeLabel;
  if (/^(19|20)\d{2}$/.test(detail)) return `${candidate.typeLabel} · ${detail}`;
  return `${candidate.typeLabel} · ${detail}`;
}

function shownPhase(mode: Mode, phase: Phase, comparePhase: Phase): Phase {
  return mode === "single" ? phase : comparePhase;
}

function modeButton(active: boolean): string {
  return active
    ? "inline-flex h-10 items-center justify-center rounded-full bg-accent px-4 text-sm font-medium text-white"
    : "inline-flex h-10 items-center justify-center rounded-full border border-line bg-surface px-4 text-sm font-medium text-muted hover:text-white";
}

function Alert({ children }: { children: ReactNode }) {
  return (
    <p className="border-l-[3px] border-l-accent rounded-xl border border-line bg-surface px-4 py-3 text-sm leading-snug text-fg shadow-card" role="alert">
      {children}
    </p>
  );
}

function SubmitButton({ busy, label, inline = false }: { busy: boolean; label: string; inline?: boolean }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className={
        inline
          ? "inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-crimson-grad px-4 text-sm font-medium text-white disabled:opacity-60 sm:px-5"
          : "inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-crimson-grad px-4 text-base font-medium text-white disabled:opacity-60"
      }
    >
      {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : inline ? <ArrowRight className="size-4" aria-hidden="true" /> : <Search className="size-5" aria-hidden="true" />}
      <span>{label}</span>
    </button>
  );
}

function SeedField({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label htmlFor={id} className="text-sm font-medium text-fg">
        {label}
      </label>
      <input
        id={id}
        name={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onInput={(event) => onChange(event.currentTarget.value)}
        placeholder="Name"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="search"
        className="h-12 w-full min-w-0 rounded-full border border-line bg-surface px-4 text-base text-fg outline-none placeholder:text-muted focus:border-accent"
      />
    </div>
  );
}

function Chooser({ title, candidates, busy, onPick }: { title: string; candidates: Candidate[]; busy: boolean; onPick: (entityId: string) => void }) {
  return (
    <section className="flex flex-col gap-3" aria-live="polite">
      <h2 className="text-sm font-medium text-fg">{title}</h2>
      <ul className="flex flex-col gap-3">
        {candidates.map((candidate) => (
          <li key={candidate.entityId}>
            <button
              type="button"
              disabled={busy}
              onClick={() => onPick(candidate.entityId)}
              className="flex w-full flex-col items-start gap-1 rounded-2xl border border-line bg-surface p-4 text-left shadow-card transition-colors hover:border-accent disabled:opacity-60"
            >
              <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">{choiceLine(candidate)}</span>
              <span className="font-display text-2xl leading-none text-fg">{candidate.name}</span>
              {candidate.blurb ? <span className="text-sm leading-snug text-muted">{candidate.blurb}</span> : null}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CompareView({ pairing }: { pairing: CompareMatch }) {
  const pdfUrl = useRef<string | null>(null);
  const pdfFile = useRef<File | null>(null);
  const [note, setNote] = useState("");

  function arm(anchor: HTMLAnchorElement) {
    const blob = pdfBlob(
      buildPairingPdf({
        leftName: pairing.left.name,
        leftType: pairing.left.typeLabel,
        rightName: pairing.right.name,
        rightType: pairing.right.typeLabel,
        overlaps: pairing.evidence.overlaps,
        explanation: pairing.explanation,
      }),
    );
    pdfFile.current = new File([blob], PDF_FILENAME, { type: "application/pdf" });
    preparePdfAnchor(anchor, navigator.userAgent, navigator.maxTouchPoints);
    if (pdfUrl.current) URL.revokeObjectURL(pdfUrl.current);
    const url = URL.createObjectURL(blob);
    pdfUrl.current = url;
    anchor.href = url;
  }

  function onPointerDown(event: PointerEvent<HTMLAnchorElement>) {
    arm(event.currentTarget);
  }

  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    const anchor = event.currentTarget;
    if (!anchor.href.startsWith("blob:") || !pdfFile.current) arm(anchor);
    const file = pdfFile.current;
    if (!file) return;
    let shareable = false;
    try {
      shareable = typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
    } catch {
      shareable = false;
    }
    if (!shareable) return;
    event.preventDefault();
    void navigator.share({ files: [file], title: "Kinship pairing" }).then(
      () => setNote(""),
      (error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        window.open(anchor.href, "_blank", "noopener");
        setNote("The download was blocked. The PDF is open in a new tab so you can save it.");
      },
    );
  }

  return (
    <section id="compare-result" className="flex flex-col gap-4" aria-live="polite">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SeedTicket entity={pairing.left} />
        <SeedTicket entity={pairing.right} />
      </div>
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-fg">Shared-fans scores</h2>
        <p className="text-sm leading-snug text-muted">{RESULT_NOTE}</p>
        {pairing.overlaps.length === 0 ? (
          <p className="text-base text-muted">These two don’t share a fan base in the data. Try another pair, like Nike vs Adidas.</p>
        ) : (
          <ul className="overflow-hidden rounded-2xl border border-line bg-surface">
            {pairing.overlaps.map((overlap, index) => (
              <li key={overlap.entityId} className="flex items-center justify-between gap-4 border-t border-line px-4 py-3 first:border-t-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-fg">{overlap.name}</p>
                  <p className="text-xs text-muted">{overlap.category}</p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {index === highMatchIndex(pairing.overlaps) ? (
                    <span className="rounded-full border border-accent px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-accent">High match</span>
                  ) : null}
                  <p className="text-sm tabular-nums">
                    <span className={scoreTone(overlap.leftScore)}>{formatAffinity(overlap.leftScore)}</span>
                    <span className="text-muted"> / </span>
                    <span className={scoreTone(overlap.rightScore)}>{formatAffinity(overlap.rightScore)}</span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-5 shadow-card">
        <h2 className="text-sm font-medium text-fg">Why this pairing</h2>
        <p className="text-base leading-snug text-fg">{pairing.explanation}</p>
      </div>
      <a
        id="pdf-download"
        href="#pdf"
        onPointerDown={onPointerDown}
        onClick={(event) => void onClick(event)}
        className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-line bg-surface px-4 text-base font-medium text-fg hover:border-accent"
      >
        <Download className="size-5" aria-hidden="true" />
        Download one-page PDF
      </a>
      {note ? <p className="text-sm text-muted">{note}</p> : null}
    </section>
  );
}

function highMatchIndex(overlaps: CompareMatch["overlaps"]): number {
  const first = overlaps[0];
  if (!first) return -1;
  const weak = Math.min(first.leftScore, first.rightScore);
  if (weak < 0.95) return -1;
  const next = overlaps[1];
  if (!next) return 0;
  return weak - Math.min(next.leftScore, next.rightScore) >= 0.015 ? 0 : -1;
}

function scoreTone(score: number): string {
  return score >= 0.95 ? "font-semibold text-accent" : "font-medium text-muted";
}

function SeedTicket({ entity }: { entity: ResolvedEntity }) {
  return (
    <article className="min-w-0 overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="bg-accent/10 px-4 py-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-accent">{entity.typeLabel}</p>
      </div>
      <div className="px-4 py-4">
        <p className="break-words text-lg font-semibold text-fg">{entity.name}</p>
        <p className="mt-1 text-xs text-muted">Resolved on Qloo</p>
      </div>
    </article>
  );
}

function ResultCard({ name, href, category, score, top = false, seed, line, onOpen }: { name: string; href: string; category: string; score: number; top?: boolean; seed: string; line?: string | null; onOpen?: () => void }) {
  const caption = line ?? `${seed} and ${name} share a strong audience overlap in Qloo’s data.`;
  return (
    <article className="flex h-full flex-col gap-3 rounded-2xl border border-[#242424] bg-[#161616] p-5">
      <div className="flex items-start justify-between gap-4">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">{category.split(" ")[0]}</p>
        <p className={`font-mono text-[28px] leading-none tabular-nums ${top ? "text-accent" : "text-accent/70"}`}>{formatAffinity(score)}</p>
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <a href={href} target="_blank" rel="noopener noreferrer" className="block break-words font-display text-[26px] leading-tight text-white">
          {name}
        </a>
        <p className="text-sm leading-snug text-muted">{caption}</p>
      </div>
      <div className="flex items-center gap-3 pt-1">
        <CopyLine line={caption} />
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-[#242424] bg-transparent px-4 text-sm font-semibold text-accent hover:border-accent"
        >
          Open pitch
        </button>
      </div>
    </article>
  );
}

type PitchData = { seed: string; seedType: string; partner: string; partnerType: string; score: number; line: string };

function pitchPdfInput(data: PitchData) {
  return {
    leftName: data.seed,
    leftType: data.seedType,
    rightName: data.partner,
    rightType: data.partnerType,
    overlaps: [],
    explanation: data.line,
    score: formatAffinity(data.score),
  };
}

export function PitchDetail({ data, onBack }: { data: PitchData; onBack: () => void }) {
  const pdfUrl = useRef<string | null>(null);
  const pdfFile = useRef<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [note, setNote] = useState("");

  // Desktop preview: build the same one-pager once per pitch; revoke on change/unmount.
  useEffect(() => {
    const url = URL.createObjectURL(pdfBlob(buildPairingPdf(pitchPdfInput(data))));
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [data]);

  useEffect(() => {
    return () => {
      if (pdfUrl.current) URL.revokeObjectURL(pdfUrl.current);
    };
  }, []);

  function arm(anchor: HTMLAnchorElement) {
    const blob = pdfBlob(buildPairingPdf(pitchPdfInput(data)));
    pdfFile.current = new File([blob], PDF_FILENAME, { type: "application/pdf" });
    preparePdfAnchor(anchor, navigator.userAgent, navigator.maxTouchPoints);
    if (pdfUrl.current) URL.revokeObjectURL(pdfUrl.current);
    const url = URL.createObjectURL(blob);
    pdfUrl.current = url;
    anchor.href = url;
  }

  function onPointerDown(event: PointerEvent<HTMLAnchorElement>) {
    arm(event.currentTarget);
  }

  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    const anchor = event.currentTarget;
    if (!anchor.href.startsWith("blob:") || !pdfFile.current) arm(anchor);
    const file = pdfFile.current;
    if (!file) return;
    let shareable = false;
    try {
      shareable = typeof navigator.canShare === "function" && navigator.canShare({ files: [file] });
    } catch {
      shareable = false;
    }
    if (!shareable) return;
    event.preventDefault();
    void navigator.share({ files: [file], title: "Kinship pitch" }).then(
      () => setNote(""),
      (error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        window.open(anchor.href, "_blank", "noopener");
        setNote("The download was blocked. The PDF is open in a new tab so you can save it.");
      },
    );
  }

  return (
    <section className="flex flex-col gap-4" aria-label="Partnership pitch">
      <button type="button" onClick={onBack} className="inline-flex w-fit items-center gap-1 text-sm font-medium text-accent">
        <ArrowRight className="size-4 rotate-180" aria-hidden="true" /> Back to results
      </button>
      <div className="rounded-3xl bg-[#f5f1e8] p-6 sm:p-10 lg:p-12">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-start lg:gap-10">
          <div className="flex min-w-0 flex-col gap-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#6b6963]">Partnership pitch</p>
            <h2 className="font-display text-3xl leading-tight text-[#141310] sm:text-4xl">
              {data.seed} × {data.partner}
            </h2>
            <div className="flex flex-col gap-1">
              <p className="font-mono text-[56px] leading-none text-[#141310] tabular-nums">{formatAffinity(data.score)}</p>
              <p className="text-xs uppercase tracking-[0.18em] text-[#6b6963]">Fans in common</p>
            </div>
            <article className="rounded-2xl border border-[#e3ddd0] bg-white p-5">
              <p className="text-sm leading-relaxed text-[#141310]">{data.line}</p>
            </article>
            <dl className="flex flex-col divide-y divide-[#e3ddd0] rounded-2xl border border-[#e3ddd0] bg-white">
              {([[''+'Seed', `${data.seed}${data.seedType ? ` · ${data.seedType}` : ""}`], ['Partner', `${data.partner} · ${data.partnerType}`]] as const).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between gap-4 px-5 py-3">
                  <dt className="text-xs uppercase tracking-[0.18em] text-[#6b6963]">{k}</dt>
                  <dd className="min-w-0 break-words text-right text-sm font-medium text-[#141310]">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="flex items-center gap-2 text-xs text-[#2e5c40]">
              <span className="h-1.5 w-1.5 flex-none rounded-full bg-[#2e9e5b]" />
              Every name and score here comes straight from Qloo’s fan data
            </p>
            <div className="flex flex-col gap-2.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <CopyLine line={data.line} label="Copy pitch" primary />
                <a
                  href={pdfUrl.current ?? "#"}
                  download={PDF_FILENAME}
                  onPointerDown={onPointerDown}
                  onClick={onClick}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-full border border-[#141310] bg-transparent px-4 text-sm font-semibold text-[#141310] hover:border-accent hover:text-accent"
                >
                  <Download className="size-4" aria-hidden="true" />
                  Export one-page PDF
                </a>
              </div>
              {note ? <p className="text-xs text-[#6b6963]" aria-live="polite">{note}</p> : null}
              <a
                href={partnerSearchHref(data.seed, data.partner)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-10 w-fit items-center justify-center gap-2 rounded-full px-1 text-sm font-medium text-[#6b6963] hover:text-accent"
              >
                Open {data.partner} on Qloo search
              </a>
            </div>
          </div>
          <div className="hidden min-w-0 flex-col gap-3 lg:flex">
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#6b6963]">PDF preview</p>
            {previewUrl ? (
              <iframe
                title="One-page PDF preview"
                src={`${previewUrl}#toolbar=0&navpanes=0&view=FitH`}
                className="aspect-[612/792] w-full rounded-2xl border border-[#e3ddd0] bg-white shadow-sm"
              />
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function CopyLine({ line, label = "Copy", primary = false }: { line: string; label?: string; primary?: boolean }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(line);
      setState("copied");
    } catch {
      setState("failed");
    }
    window.setTimeout(() => setState("idle"), 1600);
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium ${
        primary ? "bg-accent font-semibold text-accent-fg hover:opacity-90" : "self-start border border-line bg-surface text-fg hover:border-accent"
      }`}
    >
      {state === "copied" ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
      {state === "copied" ? "Copied" : state === "failed" ? copyFailureMessage() : label}
    </button>
  );
}
