"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  PlatformCard,
  SkeletonCard,
  type CheckResult,
} from "@/components/PlatformCard";
import { FILTERS, type FilterKey } from "@/components/statusStyles";
import { AllSites } from "@/components/AllSites";

const SKELETON_COUNT = 10;

export default function HomeClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialFromUrl = searchParams.get("username")?.trim() || "";

  const [username, setUsername] = useState(initialFromUrl);
  const [checkedUsername, setCheckedUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CheckResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [copied, setCopied] = useState<"user" | "link" | null>(null);
  const [recentSearches, setRecentSearches] = useState<
    Array<{ username: string; createdAt: string }>
  >([]);
  const [retrying, setRetrying] = useState<Set<string>>(new Set());
  const autoRan = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/recent");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data.searches)) {
          setRecentSearches(
            data.searches.map((s: { username: string; createdAt: string }) => ({
              username: s.username,
              createdAt: s.createdAt,
            }))
          );
        }
      } catch {
        /* optional strip */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [results]);

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

  const runCheck = useCallback(
    async (raw: string, syncUrl: boolean) => {
      const trimmed = raw.trim();
      if (!trimmed) return;

      setLoading(true);
      setError(null);
      setResults(null);
      setFilter("all");
      setCheckedUsername(trimmed);
      setUsername(trimmed);

      if (syncUrl) {
        router.replace(`/?username=${encodeURIComponent(trimmed)}`, {
          scroll: false,
        });
      }

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
    },
    [router]
  );

  /** Re-check one platform, bypassing the cache (per-card Retry button). */
  const retryPlatform = useCallback(
    async (platformId: string) => {
      const handle = checkedUsername;
      if (!handle) return;
      setRetrying((prev) => new Set(prev).add(platformId));
      try {
        const res = await fetch(
          `/api/check?username=${encodeURIComponent(handle)}&platforms=${platformId}&fresh=1`
        );
        const data = await res.json();
        const next = Array.isArray(data.results) ? (data.results as CheckResult[]).find((r) => r.platformId === platformId) : undefined;
        if (res.ok && next) {
          setResults((prev) => prev?.map((r) => (r.platformId === platformId ? next : r)) ?? prev);
        }
      } catch {
        /* keep the previous result */
      } finally {
        setRetrying((prev) => {
          const n = new Set(prev);
          n.delete(platformId);
          return n;
        });
      }
    },
    [checkedUsername]
  );

  useEffect(() => {
    if (autoRan.current) return;
    if (!initialFromUrl) return;
    autoRan.current = true;
    void runCheck(initialFromUrl, false);
  }, [initialFromUrl, runCheck]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    await runCheck(username, true);
  }

  async function copyUsername() {
    const value = checkedUsername || username.trim();
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopied("user");
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopied(null);
    }
  }

  async function copyLink() {
    const value = checkedUsername || username.trim();
    if (!value || typeof window === "undefined") return;
    const url = `${window.location.origin}/?username=${encodeURIComponent(value)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied("link");
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setCopied(null);
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
            TikTok, Reddit, YouTube — plus 1,500+ self-tested sites.
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
            Press Enter to search. Shareable links use ?username=
          </p>
          {recentSearches.length > 0 ? (
            <div className="mx-auto mt-6 max-w-2xl">
              <p className="mb-2 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                Recently checked
              </p>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((s) => (
                  <button
                    key={`${s.username}-${s.createdAt}`}
                    type="button"
                    onClick={() => void runCheck(s.username, true)}
                    className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300 transition hover:border-accent/40 hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    @{s.username}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
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
                    {copied === "user" ? "Copied" : "Copy"}
                  </button>
                  <button
                    type="button"
                    onClick={copyLink}
                    className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-300 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    {copied === "link" ? "Link copied" : "Copy link"}
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
                      {summary.unknown} not verified
                    </span>
                    {summary.invalid > 0 ? (
                      <>
                        <span className="mx-1.5 text-slate-600">·</span>
                        <span className="font-medium text-amber-300">
                          {summary.invalid} not allowed
                        </span>
                      </>
                    ) : null}
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-slate-400">
                    Querying platforms… unclear answers are retried automatically.
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
                        <PlatformCard
                          key={r.platformId}
                          result={r}
                          retrying={retrying.has(r.platformId)}
                          onRetry={r.status === "unknown" ? () => void retryPlatform(r.platformId) : undefined}
                        />
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
                        <PlatformCard
                          key={r.platformId}
                          result={r}
                          retrying={retrying.has(r.platformId)}
                          onRetry={r.status === "unknown" ? () => void retryPlatform(r.platformId) : undefined}
                        />
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

        {checkedUsername && !error ? <AllSites key={checkedUsername} username={checkedUsername} /> : null}
      </main>

      <footer className="relative z-10 border-t border-white/5 py-8 text-center text-xs text-slate-500">
        Handle Hub · availability probes never invent results ·{" "}
        <a href="/status" className="hover:text-slate-300">Platform health</a> · catalog data: WhatsMyName (CC BY-SA 4.0), Sherlock &amp; Maigret (MIT)
      </footer>
    </div>
  );
}
