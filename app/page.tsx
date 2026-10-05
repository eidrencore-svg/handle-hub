"use client";

import { FormEvent, useMemo, useState } from "react";

type CheckResult = {
  platformId: string;
  platformName: string;
  kind: string;
  status: string;
  profileUrl?: string;
  meta?: Record<string, unknown>;
};

type FilterKey = "all" | "available" | "taken" | "unknown" | "invalid";

const FILTERS: { id: FilterKey; label: string }[] = [
  { id: "all", label: "All" },
  { id: "available", label: "Available" },
  { id: "taken", label: "Taken" },
  { id: "unknown", label: "Unknown" },
];

const SKELETON_COUNT = 10;

function statusBadgeClasses(status: string): string {
  switch (status) {
    case "available":
      return "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30";
    case "taken":
      return "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30";
    case "invalid":
      return "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30";
    default:
      return "bg-slate-500/15 text-slate-300 ring-1 ring-slate-500/30";
  }
}

function kindLabel(kind: string): string {
  return kind === "gaming" ? "Gaming" : "Social";
}

function PlatformCard({ result }: { result: CheckResult }) {
  const note =
    typeof result.meta?.note === "string" ? result.meta.note : undefined;

  return (
    <article
      className="group relative flex flex-col rounded-2xl border border-white/10 bg-ink-800/70 p-4 shadow-card backdrop-blur transition hover:border-accent/40 hover:bg-ink-700/80"
      title={note}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-white">
            {result.platformName}
          </h3>
          <p className="mt-0.5 text-xs uppercase tracking-wide text-slate-400">
            {kindLabel(result.kind)}
          </p>
        </div>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${statusBadgeClasses(result.status)}`}
        >
          {result.status}
        </span>
      </div>

      <div className="mt-4 flex min-h-[1.25rem] items-center justify-between gap-2">
        {result.status === "taken" && result.profileUrl ? (
          <a
            href={result.profileUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-accent-soft underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            View profile
          </a>
        ) : (
          <span className="text-sm text-slate-500">—</span>
        )}
      </div>

      {note ? (
        <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-slate-400 opacity-80 transition group-hover:opacity-100">
          {note}
        </p>
      ) : null}
    </article>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-white/5 bg-ink-800/50 p-4">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="h-4 w-24 rounded bg-slate-700/70" />
          <div className="h-3 w-14 rounded bg-slate-700/40" />
        </div>
        <div className="h-6 w-16 rounded-full bg-slate-700/50" />
      </div>
      <div className="mt-5 h-3 w-20 rounded bg-slate-700/40" />
    </div>
  );
}

export default function HomePage() {
  const [username, setUsername] = useState("");
  const [checkedUsername, setCheckedUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CheckResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [copied, setCopied] = useState(false);

  const summary = useMemo(() => {
    const counts = { available: 0, taken: 0, unknown: 0, invalid: 0 };
    for (const r of results ?? []) {
      if (r.status in counts) {
        counts[r.status as keyof typeof counts] += 1;
      } else {
        counts.unknown += 1;
      }
    }
    return counts;
  }, [results]);

  const filtered = useMemo(() => {
    if (!results) return [];
    if (filter === "all") return results;
    return results.filter((r) => r.status === filter);
  }, [results, filter]);

  const gaming = filtered.filter((r) => r.kind === "gaming");
  const social = filtered.filter((r) => r.kind === "social");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);
    setResults(null);
    setFilter("all");
    setCheckedUsername(trimmed);

    try {
      const res = await fetch(
        `/api/check?username=${encodeURIComponent(trimmed)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Check failed");
      setResults(data.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function copyUsername() {
    const value = checkedUsername || username.trim();
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-hero-radial" />
      <div className="pointer-events-none absolute -left-24 top-40 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 top-24 h-80 w-80 rounded-full bg-accent-glow/15 blur-3xl" />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-4 py-6 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-glow shadow-glow">
            <span className="text-sm font-bold text-white">H</span>
          </div>
          <span className="text-sm font-semibold tracking-wide text-slate-200">
            Handle Hub
          </span>
        </div>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-400">
          Beta
        </span>
      </header>

      <main className="relative z-10 mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-6 sm:pt-14">
        <section className="mx-auto max-w-3xl text-center">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            Multi-platform username intelligence
          </p>
          <h1 className="text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl md:text-6xl">
            Find your next{" "}
            <span className="bg-gradient-to-r from-accent-soft via-white to-accent-glow bg-clip-text text-transparent">
              handle
            </span>{" "}
            everywhere
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-balance text-base leading-relaxed text-slate-400 sm:text-lg">
            Search once across gaming and social platforms. Instant availability
            signals for Steam, Xbox, PlayStation, Twitch, Discord, X, Instagram,
            TikTok, Reddit, YouTube, and more.
          </p>

          <form
            onSubmit={onSubmit}
            className="mx-auto mt-10 flex max-w-2xl flex-col gap-3 sm:flex-row sm:items-stretch"
            role="search"
            aria-label="Username availability search"
          >
            <label htmlFor="username" className="sr-only">
              Username
            </label>
            <div className="relative flex-1">
              <span
                aria-hidden
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500"
              >
                @
              </span>
              <input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter a username"
                autoComplete="off"
                spellCheck={false}
                className="h-14 w-full rounded-2xl border border-white/10 bg-ink-800/80 pl-10 pr-4 text-base text-white shadow-card outline-none ring-0 placeholder:text-slate-500 transition focus:border-accent/60 focus:ring-2 focus:ring-accent/40"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !username.trim()}
              className="inline-flex h-14 items-center justify-center rounded-2xl bg-gradient-to-r from-accent to-accent-glow px-8 text-sm font-semibold text-white shadow-glow transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Checking…" : "Check"}
            </button>
          </form>

          <p className="mt-3 text-xs text-slate-500">
            Press Enter to search. Results never invent availability.
          </p>
        </section>

        <div aria-live="polite" aria-atomic="true" className="sr-only">
          {loading
            ? `Checking username ${checkedUsername || username}`
            : results
              ? `Found ${results.length} platform results for ${checkedUsername}`
              : error
                ? `Error: ${error}`
                : ""}
        </div>

        {error ? (
          <div
            role="alert"
            className="mx-auto mt-8 max-w-2xl rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
          >
            {error}
          </div>
        ) : null}

        {(loading || results) && (
          <section className="mt-12 space-y-8">
            <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-ink-900/70 p-4 shadow-card backdrop-blur sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-slate-400">Results for</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <p className="text-xl font-semibold text-white">
                    @{checkedUsername}
                  </p>
                  <button
                    type="button"
                    onClick={copyUsername}
                    className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-300 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                {!loading && results ? (
                  <p className="mt-2 text-sm text-slate-400">
                    <span className="font-medium text-rose-300">
                      {summary.taken} taken
                    </span>
                    <span className="mx-1.5 text-slate-600">·</span>
                    <span className="font-medium text-emerald-300">
                      {summary.available} available
                    </span>
                    <span className="mx-1.5 text-slate-600">·</span>
                    <span className="font-medium text-slate-300">
                      {summary.unknown} unknown
                    </span>
                    {summary.invalid > 0 ? (
                      <>
                        <span className="mx-1.5 text-slate-600">·</span>
                        <span className="font-medium text-amber-300">
                          {summary.invalid} invalid
                        </span>
                      </>
                    ) : null}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-slate-400">
                    Querying platforms…
                  </p>
                )}
              </div>

              <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-label="Filter results by status"
              >
                {FILTERS.map((f) => {
                  const active = filter === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFilter(f.id)}
                      disabled={loading}
                      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                        active
                          ? "bg-accent text-white shadow-glow"
                          : "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                      } disabled:opacity-50`}
                      aria-pressed={active}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}
              </div>
            ) : (
              <>
                {gaming.length > 0 && (
                  <div>
                    <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Gaming
                    </h2>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {gaming.map((r) => (
                        <PlatformCard key={r.platformId} result={r} />
                      ))}
                    </div>
                  </div>
                )}

                {social.length > 0 && (
                  <div>
                    <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Social
                    </h2>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {social.map((r) => (
                        <PlatformCard key={r.platformId} result={r} />
                      ))}
                    </div>
                  </div>
                )}

                {filtered.length === 0 && (
                  <p className="rounded-2xl border border-white/10 bg-ink-800/50 px-4 py-8 text-center text-sm text-slate-400">
                    No platforms match this filter.
                  </p>
                )}
              </>
            )}
          </section>
        )}
      </main>

      <footer className="relative z-10 border-t border-white/5 py-8 text-center text-xs text-slate-500">
        Handle Hub · availability probes never invent results
      </footer>
    </div>
  );
}
