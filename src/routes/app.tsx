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
  type Candidate,
  type CompareResult,
  type GraphStatus,
  type Pitch,
  type ResolvedEntity,
  type UncheckedCategory,
} from "@/lib/kinship-door";
import { KinshipWordmark } from "@/components/kinship-wordmark";
import { PDF_FILENAME, buildPairingPdf, pdfBlob, preparePdfAnchor } from "@/lib/kinship-pdf";

export const Route = createFileRoute("/app")({ component: Home });

const EXAMPLES = ["Radiohead", "Nike", "Davido"] as const;
const DISCLAIMER =
  "Audience affinity reflects a connection in Qloo’s taste graph. It does not confirm an existing partnership, prove that a new partnership is available, or guarantee business compatibility. The numbers are affinity scores, not the chance a partnership succeeds.";

type Phase = "idle" | "loading" | "matched" | "ambiguous" | "no-match" | "missing-key" | "refused" | "unavailable";
type Mode = "single" | "compare";
type CompareMatch = Extract<CompareResult, { status: "matched" }>;

function problemCopy(reason: "empty" | "too-long" | "invalid"): string {
  if (reason === "too-long") return "That name is too long. Use 120 characters or fewer.";
  return "Enter an artist, film, or brand.";
}

function Home() {
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
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [unchecked, setUnchecked] = useState<UncheckedCategory[]>([]);
  const [graphStatus, setGraphStatus] = useState<GraphStatus>("empty");
  const [error, setError] = useState("");
  const [comparePhase, setComparePhase] = useState<Phase>("idle");
  const [compareError, setCompareError] = useState("");
  const [leftCandidates, setLeftCandidates] = useState<Candidate[]>([]);
  const [rightCandidates, setRightCandidates] = useState<Candidate[]>([]);
  const [pairing, setPairing] = useState<CompareMatch | null>(null);

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
        setPhase("ambiguous");
        return;
      }
      if (result.status === "matched") {
        setMatch(result.entity);
        setPitches(result.pitches);
        setUnchecked(result.unchecked);
        setGraphStatus(result.graphStatus);
        setPhase("matched");
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

  return (
    <div className="flex w-full flex-col overflow-x-hidden bg-bg">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center justify-between gap-3 px-5">
          <a href="/" aria-label="Kinship home" className="shrink-0">
            <KinshipWordmark />
          </a>
          <a href="https://github.com/thisishaidee/kinship" target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-muted hover:text-white sm:text-sm">
            GitHub
          </a>
        </div>
      </header>
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-5 pb-8 pt-6 sm:pt-8">
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-4xl leading-none text-white sm:text-[44px]">
          A partnership, <span className="italic text-accent">not a playlist.</span>
        </h1>
        <p className="text-base text-muted">
          {mode === "single"
            ? "Type an artist, film, or brand. Each pitch can only name entities Qloo scored."
            : "Compare two exact Qloo entities. A shared name appears only when both results use the same entity."}
        </p>
      </header>

      <HowItWorks />

      <div className="grid grid-cols-2 gap-2">
        <button type="button" aria-pressed={mode === "single"} onClick={() => setMode("single")} className={modeButton(mode === "single")}>
          One seed
        </button>
        <button type="button" aria-pressed={mode === "compare"} onClick={() => setMode("compare")} className={modeButton(mode === "compare")}>
          Compare
        </button>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        {mode === "single" ? (
          <div className="flex min-w-0 items-center gap-2 rounded-full border border-line bg-surface py-1.5 pl-5 pr-1.5 focus-within:border-accent">
            <label htmlFor="seed" className="sr-only">
              Seed
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
            <SubmitButton busy={busy} label={busy ? "Asking the taste graph" : "Find partners"} inline />
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
        {mode === "compare" ? <SubmitButton busy={busy} label={busy ? "Asking the taste graph" : "Compare affinities"} /> : null}
      </form>

      {mode === "single" && phase === "idle" ? (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-fg">No pitch yet</h2>
          <p className="text-base text-muted">The field starts empty. Pick a seed, or type your own. Kinship will not invent a partner.</p>
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
        <Chooser title={`More than one Qloo entity matches “${heldSeed}”.`} candidates={candidates} busy={busy} onPick={(id) => void run(heldSeed, id)} />
      ) : null}

      {mode === "single" && (phase === "matched" || (phase === "unavailable" && match)) ? (
        <section className="flex flex-col gap-3" aria-busy={busy} aria-live="polite">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-medium text-fg">Pitch cards</h2>
            <p className="text-sm text-muted">{phase === "matched" ? `${pitches.length} from the strongest affinity scores` : "No pitch"}</p>
          </div>
          {phase === "matched" && pitches.length > 0 ? <p className="text-sm leading-snug text-muted">{DISCLAIMER}</p> : null}
          {phase === "matched" && pitches.length === 0 ? (
            <p className="text-base text-muted">
              {graphStatus === "partial"
                ? `Qloo resolved ${match?.name ?? "the name"}, but the categories that answered had no score. No pitch was invented.`
                : `Qloo resolved ${match?.name ?? "the name"}, but no category came back with a score. No pitch was invented.`}
            </p>
          ) : null}
          {phase === "unavailable" && match ? (
            <p className="text-base text-muted">Qloo resolved {match.name}, but the categories could not be checked. No pitch was invented.</p>
          ) : null}
          {phase === "matched" && pitches.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {pitches.map((pitch, index) => (
                <li key={pitch.id}>
                  <PitchCard pitch={pitch} seedName={match?.name ?? heldSeed} index={String(index + 1).padStart(2, "0")} />
                </li>
              ))}
            </ul>
          ) : null}
          {unchecked.map((category) => (
            <p key={category.id} className="text-sm text-accent" role="status">
              {category.line}
            </p>
          ))}
          {phase === "matched" && pitches.length > 0 && unchecked.length === 0 ? (
            <p className="text-sm text-muted">The line only cites Qloo names and affinity scores. Weaker categories are left off.</p>
          ) : null}
        </section>
      ) : null}

      {mode === "compare" && comparePhase === "ambiguous" ? (
        <div className="flex flex-col gap-6">
          {leftCandidates.length > 0 ? (
            <Chooser
              title={`More than one Qloo entity matches “${leftSeed.trim()}”.`}
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
              title={`More than one Qloo entity matches “${rightSeed.trim()}”.`}
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
  const steps = ["You enter a name", "Qloo resolves the entity", "/v2/insights affinity query", "Pitch cards or compare", "Optional explanation of those scores"];
  return (
    <section className="flex flex-col gap-3" aria-labelledby="how-it-works">
      <h2 id="how-it-works" className="text-sm font-medium text-fg">
        How it works
      </h2>
      <p className="text-sm leading-snug text-muted">
        One name goes to Qloo search, which resolves the exact entity. Kinship then calls /v2/insights for audience affinity. The cards and the compare cite only those scores. A short explanation, when it appears, may only use the names and scores Qloo returned.
      </p>
      <ol className="flex flex-col">
        {steps.map((step, index) => (
          <li key={step} className="flex flex-col">
            <div className="flex items-center gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-line text-xs font-medium text-accent">{index + 1}</span>
              <span className="text-sm text-fg">{step}</span>
            </div>
            {index < steps.length - 1 ? <span className="ml-3.5 h-3 w-px bg-line" aria-hidden="true" /> : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

function LoadingSteps({ mode }: { mode: Mode }) {
  const steps =
    mode === "compare"
      ? ["Resolving both entities", "Reading both taste graphs", "Building the compare"]
      : ["Resolving the entity", "Reading the taste graph", "Building the pitch"];
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
            {index < step ? "Done. " : index === step ? "Now. " : ""}
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
      <span className={inline ? "sr-only sm:not-sr-only" : undefined}>{label}</span>
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
    <section className="flex flex-col gap-4" aria-live="polite">
      <div className="grid grid-cols-1 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        <EntityCard entity={pairing.left} />
        <EntityCard entity={pairing.right} />
      </div>
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-fg">Shared affinities</h2>
        <p className="text-sm leading-snug text-muted">{DISCLAIMER}</p>
        {pairing.overlaps.length === 0 ? (
          <p className="text-base text-muted">No entity appeared in both Qloo results. No overlap was invented.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
            {pairing.overlaps.map((overlap) => {
              const low = Math.min(overlap.leftScore, overlap.rightScore);
              return (
                <li key={overlap.entityId} className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[#27272A] bg-[#111114]">
                  <div className="flex items-center justify-between gap-3 bg-accent/15 px-5 py-3">
                    <p className="min-w-0 truncate text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-200">{overlap.category}</p>
                    <p className="shrink-0 font-sans text-xs font-medium tabular-nums text-zinc-200">
                      L {formatAffinity(overlap.leftScore)} · R {formatAffinity(overlap.rightScore)}
                    </p>
                  </div>
                  <div className="flex flex-col gap-4 p-5">
                    <div className="flex min-w-0 flex-col items-start gap-2">
                      <p className="min-w-0 break-words font-sans text-lg font-semibold leading-tight text-white">{overlap.name}</p>
                      <TierPill score={low} />
                    </div>
                    <div className="grid grid-cols-2 gap-4 border-t border-dashed border-[#3f3f46] pt-4">
                      <ScoreBlock label="first" score={overlap.leftScore} />
                      <ScoreBlock label="second" score={overlap.rightScore} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-5 shadow-card">
        <h2 className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted">Why this pairing</h2>
        <p className="font-display text-xl leading-snug text-white">{pairing.explanation}</p>
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

function EntityCard({ entity }: { entity: ResolvedEntity }) {
  return (
    <article className="flex min-w-0 flex-col gap-2 p-4 sm:p-5">
      <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted">Resolved on Qloo</p>
      <p className="break-words font-sans text-lg font-semibold leading-tight text-white sm:text-xl">{entity.name}</p>
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-accent">{entity.typeLabel}</p>
    </article>
  );
}

function PitchCard({ pitch, seedName, index }: { pitch: Pitch; seedName: string; index: string }) {
  const primary = index === "01";
  const top = pitch.hits.reduce((best, hit) => Math.max(best, hit.score), 0);
  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[#27272A] bg-[#111114]">
      <div className={`flex items-center justify-between gap-3 px-5 py-3 ${primary ? "bg-accent" : "bg-accent/15"}`}>
        <p className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${primary ? "text-white" : "text-zinc-200"}`}>Partner {index}</p>
        <p className={`font-sans text-xs font-medium tabular-nums ${primary ? "text-white" : "text-zinc-200"}`}>{formatAffinity(top)}</p>
      </div>
      <div className="flex flex-col gap-4 p-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-zinc-500">{pitch.partnerType}</p>
        <ul className="flex flex-col gap-4">
          {pitch.hits.map((hit) => (
            <li key={hit.entityId} className="flex min-w-0 items-start justify-between gap-3">
              <div className="flex min-w-0 flex-col items-start gap-2">
                <a
                  href={partnerSearchHref(seedName, hit.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-0 break-words font-sans text-xl font-semibold leading-tight text-white underline decoration-1 underline-offset-4"
                >
                  {hit.name}
                </a>
                <TierPill score={hit.score} />
              </div>
              <span className="shrink-0 pt-1 font-sans text-sm font-medium tabular-nums text-zinc-400">{formatAffinity(hit.score)}</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-4 border-t border-dashed border-[#3f3f46] pt-4">
          <p className="font-display text-lg leading-snug text-white">{pitch.line}</p>
          <div className="flex items-end justify-between gap-3">
            <span className={`font-sans text-5xl font-semibold leading-none tracking-[-0.03em] tabular-nums ${primary ? "text-accent" : "text-white"}`}>{formatAffinity(top)}</span>
            <CopyLine line={pitch.line} />
          </div>
        </div>
      </div>
    </article>
  );
}

function affinityTier(score: number): { label: string; className: string } {
  if (score >= 0.97) return { label: "high affinity", className: "border-accent/50 bg-accent/20 text-zinc-100" };
  if (score >= 0.93) return { label: "strong", className: "border-accent/30 bg-accent/10 text-zinc-300" };
  return { label: "solid", className: "border-[#3f3f46] bg-transparent text-zinc-400" };
}

function TierPill({ score }: { score: number }) {
  const tier = affinityTier(score);
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide ${tier.className}`}>{tier.label}</span>
  );
}

function ScoreBlock({ label, score }: { label: string; score: number }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-[9px] font-medium uppercase tracking-[0.22em] text-muted/80">{label}</span>
      <span className="font-sans text-2xl font-medium leading-none tracking-[-0.02em] tabular-nums text-white">{formatAffinity(score)}</span>
    </div>
  );
}

function CopyLine({ line }: { line: string }) {
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
      className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-full border border-line bg-surface px-4 text-sm font-medium text-fg hover:border-accent"
    >
      {state === "copied" ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
      {state === "copied" ? "Copied" : state === "failed" ? copyFailureMessage() : "Copy line"}
    </button>
  );
}
