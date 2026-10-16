import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState, type FormEvent } from "react";
import { Check, Copy, Loader2, Search } from "lucide-react";
import {
  copyFailureMessage,
  isLatestRequest,
  partnerSearchHref,
  resolveKinshipSeed,
  type Candidate,
  type GraphStatus,
  type Pitch,
  type ResolvedEntity,
  type UncheckedCategory,
} from "@/lib/kinship-door";

export const Route = createFileRoute("/")({ component: Home });

const EXAMPLE = "Radiohead";
const PLACEHOLDERS = ["01", "02", "03"] as const;

type Phase = "idle" | "loading" | "matched" | "ambiguous" | "no-match" | "missing-key" | "refused" | "unavailable";

function problemCopy(reason: "empty" | "too-long" | "invalid"): string {
  if (reason === "too-long") return "That name is too long. Use 120 characters or fewer.";
  return "Enter an artist, film, or brand.";
}

function Home() {
  const resolveSeed = useServerFn(resolveKinshipSeed);
  const requestSeq = useRef(0);
  const [seed, setSeed] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [heldSeed, setHeldSeed] = useState("");
  const [match, setMatch] = useState<ResolvedEntity | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [unchecked, setUnchecked] = useState<UncheckedCategory[]>([]);
  const [graphStatus, setGraphStatus] = useState<GraphStatus>("empty");
  const [error, setError] = useState("");

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

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void run(seed.trim());
  }

  const busy = phase === "loading";

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col gap-8 px-5 py-8">
      <header className="flex flex-col gap-2">
        <p className="text-sm font-medium tracking-wide text-accent">Kinship</p>
        <h1 className="font-display text-4xl leading-none text-fg">A partnership, not a playlist.</h1>
        <p className="text-base text-muted">
          Type an artist, film, or brand, or tap the example. Each pitch can only name entities Qloo scored.
        </p>
      </header>

      <form onSubmit={onSubmit} className="flex flex-col gap-3">
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
        {error ? (
          <p className="text-sm text-accent" role="alert">
            {error}
          </p>
        ) : null}
        {phase === "missing-key" ? (
          <p className="text-sm text-accent" role="alert">
            The Qloo key is not on the server. This page cannot hold it.
          </p>
        ) : null}
        {phase === "refused" ? (
          <p className="text-sm text-accent" role="alert">
            Qloo refused the server key.
          </p>
        ) : null}
        {phase === "unavailable" && !match ? (
          <p className="text-sm text-accent" role="alert">
            Qloo did not answer. Try again.
          </p>
        ) : null}
        {phase === "no-match" ? (
          <p className="text-sm text-accent" role="alert">
            No exact Qloo match for “{heldSeed}”. Kinship will not use a similar name.
          </p>
        ) : null}
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setSeed(EXAMPLE);
            void run(EXAMPLE);
          }}
          className="inline-flex h-12 items-center justify-center rounded-card border border-line px-4 text-base font-medium text-fg disabled:opacity-60"
        >
          Try {EXAMPLE}
        </button>
        {busy ? (
          <p className="text-sm text-muted">Resolving the seed, then scoring brands, places, destinations, and artists.</p>
        ) : null}
        <button
          type="submit"
          disabled={busy}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-card bg-accent px-4 text-base font-medium text-accent-fg disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <Search className="size-5" aria-hidden="true" />}
          {busy ? "Asking the taste graph" : "Find partners"}
        </button>
      </form>

      {match ? (
        <section className="flex flex-col gap-1 rounded-card border border-line bg-surface p-4">
          <p className="text-sm text-muted">Resolved on Qloo</p>
          <p className="font-display text-3xl leading-none text-fg">{match.name}</p>
          <p className="text-sm font-medium text-accent">{match.typeLabel}</p>
        </section>
      ) : null}

      {phase === "ambiguous" ? (
        <section className="flex flex-col gap-3" aria-live="polite">
          <h2 className="text-sm font-medium text-fg">More than one Qloo entity is named “{heldSeed}”.</h2>
          <ul className="flex flex-col gap-3">
            {candidates.map((candidate) => (
              <li key={candidate.entityId}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void run(heldSeed, candidate.entityId)}
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
      ) : (
        <section className="flex flex-col gap-3" aria-busy={busy} aria-live="polite">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-sm font-medium text-fg">Pitch cards</h2>
            <p className="text-sm text-muted">{phase === "matched" ? `${pitches.length} from the strongest scores` : "Three at most"}</p>
          </div>
          {phase === "matched" && pitches.length === 0 ? (
            <p className="text-base text-muted">
              {graphStatus === "partial"
                ? `Qloo resolved ${match?.name ?? "the name"}, but the categories that answered had no score. No pitch was invented.`
                : `Qloo resolved ${match?.name ?? "the name"}, but no category came back with a score. No pitch was invented.`}
            </p>
          ) : null}
          {phase === "unavailable" && match ? (
            <p className="text-base text-muted">
              Qloo resolved {match.name}, but the categories could not be checked. No pitch was invented.
            </p>
          ) : null}
          <ul className="flex flex-col gap-3">
            {phase === "matched"
              ? pitches.map((pitch, index) => (
                  <li key={pitch.id}>
                    <PitchCard pitch={pitch} seedName={match?.name ?? heldSeed} index={String(index + 1).padStart(2, "0")} />
                  </li>
                ))
              : PLACEHOLDERS.map((index) => (
                  <li key={index}>
                    <EmptyPitch index={index} loading={busy} />
                  </li>
                ))}
          </ul>
          {unchecked.map((category) => (
            <p key={category.id} className="text-sm text-accent" role="status">
              {category.line}
            </p>
          ))}
          {unchecked.length === 0 ? (
            <p className="text-sm text-muted">The line only cites Qloo names and affinity scores. Weaker categories are left off.</p>
          ) : null}
        </section>
      )}
    </main>
  );
}

function EmptyPitch({ index, loading }: { index: string; loading: boolean }) {
  return (
    <article className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">{index}</p>
        <p className="text-sm font-medium text-fg">Partner type</p>
      </div>
      <p className={loading ? "animate-pulse text-base text-muted" : "text-base text-fg"}>{loading ? "Asking Qloo" : "Waiting"}</p>
      <p className="border-t border-line pt-3 font-display text-lg leading-snug text-fg">The line appears when the graph answers.</p>
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
            <span className="shrink-0 text-sm font-medium text-accent">{hit.score.toFixed(2)}</span>
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
