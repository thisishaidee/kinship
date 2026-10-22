import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { Check, Copy, Download, Loader2, Search } from "lucide-react";
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
import { PAIRING_DISCLAIMER, buildPairingPdf } from "@/lib/kinship-pdf";

export const Route = createFileRoute("/")({ component: Home });

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

  async function runCompare(leftId?: string, rightId?: string) {
    const left = leftSeed.trim();
    const right = rightSeed.trim();
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
    if (mode === "single") void run(seed.trim());
    else void runCompare();
  }

  function downloadPairing() {
    if (!pairing) return;
    const bytes = buildPairingPdf({
      leftName: pairing.left.name,
      leftType: pairing.left.typeLabel,
      rightName: pairing.right.name,
      rightType: pairing.right.typeLabel,
      overlaps: pairing.evidence.overlaps,
      explanation: pairing.explanation,
    });
    const blob = new Blob([Uint8Array.from(bytes)], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "kinship-pairing.pdf";
    link.click();
    URL.revokeObjectURL(url);
  }

  const busy = mode === "single" ? phase === "loading" : comparePhase === "loading";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-8 px-5 py-8">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium tracking-wide text-accent">Kinship</p>
        <h1 className="font-display text-4xl leading-none text-fg">A partnership, not a playlist.</h1>
        <p className="text-base text-muted">
          {mode === "single"
            ? "Type an artist, film, or brand. Each pitch can only name entities Qloo scored."
            : "Compare two exact Qloo entities. A shared name appears only when both results use the same entity."}
        </p>
      </header>

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
          <>
            <label htmlFor="seed" className="text-sm font-medium text-fg">
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
              placeholder="Artist, film, or brand"
              autoComplete="off"
              enterKeyHint="search"
              className="h-12 w-full rounded-card border border-line bg-surface px-4 text-base text-fg outline-none placeholder:text-muted focus:border-accent"
            />
          </>
        ) : (
          <div className="grid grid-cols-2 gap-3">
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
        {busy ? <p className="text-sm text-muted">Asking Qloo. Nothing is filled in until the graph answers.</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-card bg-accent px-4 text-base font-medium text-accent-fg disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <Search className="size-5" aria-hidden="true" />}
          {busy ? "Asking the taste graph" : mode === "single" ? "Find partners" : "Compare affinities"}
        </button>
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
                className="inline-flex h-11 items-center rounded-card border border-line px-4 text-sm font-medium text-fg"
              >
                {example}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {mode === "single" && match ? (
        <section className="flex flex-col gap-1 rounded-card border border-line bg-surface p-4">
          <p className="text-sm text-muted">Resolved on Qloo</p>
          <p className="font-display text-3xl leading-none text-fg">{match.name}</p>
          <p className="text-sm font-medium text-accent">{match.typeLabel}</p>
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
                void runCompare(id, picks.current.right);
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
                void runCompare(picks.current.left, id);
              }}
            />
          ) : null}
        </div>
      ) : null}

      {mode === "compare" && pairing ? <CompareView pairing={pairing} onDownload={downloadPairing} /> : null}
    </main>
  );
}

function shownPhase(mode: Mode, phase: Phase, comparePhase: Phase): Phase {
  return mode === "single" ? phase : comparePhase;
}

function modeButton(active: boolean): string {
  return active
    ? "inline-flex h-11 items-center justify-center rounded-card bg-accent px-4 text-sm font-medium text-accent-fg"
    : "inline-flex h-11 items-center justify-center rounded-card border border-line px-4 text-sm font-medium text-fg";
}

function Alert({ children }: { children: ReactNode }) {
  return (
    <p className="text-sm text-accent" role="alert">
      {children}
    </p>
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
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Name"
        autoComplete="off"
        enterKeyHint="search"
        className="h-12 w-full min-w-0 rounded-card border border-line bg-surface px-3 text-base text-fg outline-none placeholder:text-muted focus:border-accent"
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
              className="flex w-full flex-col items-start gap-1 rounded-card border border-line bg-surface p-4 text-left disabled:opacity-60"
            >
              <span className="font-display text-2xl leading-none text-fg">{candidate.name}</span>
              <span className="text-sm font-medium text-accent">{candidate.typeLabel}</span>
              {candidate.detail ? <span className="text-sm text-muted">{candidate.detail}</span> : null}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CompareView({ pairing, onDownload }: { pairing: CompareMatch; onDownload: () => void }) {
  return (
    <section className="flex flex-col gap-4" aria-live="polite">
      <div className="grid grid-cols-2 gap-3">
        <EntityCard entity={pairing.left} />
        <EntityCard entity={pairing.right} />
      </div>
      <div className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-fg">Shared affinities</h2>
        <p className="text-sm leading-snug text-muted">{DISCLAIMER}</p>
        {pairing.overlaps.length === 0 ? (
          <p className="text-base text-muted">No entity appeared in both Qloo results. No overlap was invented.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {pairing.overlaps.map((overlap) => (
              <li key={overlap.entityId} className="flex flex-col gap-1 rounded-card border border-line bg-surface p-4">
                <p className="text-base text-fg">{overlap.name}</p>
                <p className="text-sm text-muted">{overlap.category}</p>
                <p className="text-sm text-accent">
                  {formatAffinity(overlap.leftScore)} / {formatAffinity(overlap.rightScore)} affinity
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex flex-col gap-2 rounded-card border border-line bg-surface p-4">
        <h2 className="text-sm font-medium text-fg">Why this pairing</h2>
        <p className="font-display text-lg leading-snug text-fg">{pairing.explanation}</p>
        <p className="text-sm text-muted">
          {pairing.explanationSource === "model"
            ? "Written from the affinity JSON above. Names and scores outside that JSON were rejected."
            : "The model draft went outside the returned scores, so this line cites those scores directly."}
        </p>
        <p className="text-sm text-muted">{PAIRING_DISCLAIMER}</p>
      </div>
      <button type="button" onClick={onDownload} className="inline-flex h-12 items-center justify-center gap-2 rounded-card border border-line px-4 text-base font-medium text-fg">
        <Download className="size-5" aria-hidden="true" />
        Download one-page PDF
      </button>
    </section>
  );
}

function EntityCard({ entity }: { entity: ResolvedEntity }) {
  return (
    <article className="flex min-w-0 flex-col gap-1 rounded-card border border-line bg-surface p-4">
      <p className="text-sm text-muted">Resolved on Qloo</p>
      <p className="break-words font-display text-2xl leading-none text-fg">{entity.name}</p>
      <p className="text-sm font-medium text-accent">{entity.typeLabel}</p>
    </article>
  );
}

function PitchCard({ pitch, seedName, index }: { pitch: Pitch; seedName: string; index: string }) {
  return (
    <article className="flex flex-col gap-4 rounded-card border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">{index}</p>
        <h3 className="text-sm font-medium text-fg">{pitch.partnerType}</h3>
      </div>
      <ul className="flex flex-col gap-2">
        {pitch.hits.map((hit) => (
          <li key={hit.entityId} className="flex items-baseline justify-between gap-3">
            <a
              href={partnerSearchHref(seedName, hit.name)}
              target="_blank"
              rel="noopener noreferrer"
              className="min-w-0 break-words py-1 text-left text-base text-fg underline decoration-1 underline-offset-4"
            >
              {hit.name}
            </a>
            <span className="shrink-0 text-sm font-medium text-accent">
              {formatAffinity(hit.score)}
              <span className="font-normal text-muted"> affinity</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="border-t border-line pt-3 font-display text-lg leading-snug text-fg">{pitch.line}</p>
      <CopyLine line={pitch.line} />
    </article>
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
      className="inline-flex h-11 items-center justify-center gap-2 self-start rounded-card border border-line px-4 text-sm font-medium text-fg"
    >
      {state === "copied" ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
      {state === "copied" ? "Copied" : state === "failed" ? copyFailureMessage() : "Copy line"}
    </button>
  );
}
