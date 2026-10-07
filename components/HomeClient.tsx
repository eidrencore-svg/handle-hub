"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  PlatformCard,
  SkeletonCard,
  type CheckResult,
} from "@/components/PlatformCard";
import { FILTERS, statusDotClass, type FilterKey } from "@/components/statusStyles";
import { AllSites } from "@/components/AllSites";

const SKELETON_COUNT = 10;
const STATUS_ORDER: Record<string, number> = { available: 0, taken: 1, unknown: 2, invalid: 3 };
const byStatus = (a: CheckResult, b: CheckResult) =>
  (STATUS_ORDER[a.status] ?? 2) - (STATUS_ORDER[b.status] ?? 2);

const FEATURES: { title: string; body: string }[] = [
  { title: "Core first", body: "Steam, Xbox, PlayStation, Twitch, X, Instagram, TikTok, Discord, Reddit and YouTube, each with its real platform rules." },
  { title: "Then the long tail", body: "1,500+ self-tested sites in one streaming scan." },
  { title: "Honest results", body: "When a wall or rate limit hits we say Couldn't verify. Never a fake Available." },
  { title: "Act from the card", body: "Claim it if it's free, open the profile if it's taken, or retry when it's unclear." },
  { title: "Live scan", body: "Results stream in as they land, with Available sorted to the top." },
  { title: "Stay consistent", body: "See where one handle works across platforms before you commit to it." },
];

export default function HomeClient({ header }: { header?: React.ReactNode }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialFromUrl = searchParams.get("username")?.trim() || "";

  const [username, setUsername] = useState(initialFromUrl);
  const [checkedUsername, setCheckedUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<CheckResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [upgradeUrl, setUpgradeUrl] = useState<string | null>(null);
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

  const gaming = filtered.filter((r) => r.kind === "gaming").sort(byStatus);
  const social = filtered.filter((r) => r.kind === "social").sort(byStatus);

  const runCheck = useCallback(
    async (raw: string, syncUrl: boolean) => {
      const trimmed = raw.trim();
      if (!trimmed) return;

      setLoading(true);
      setError(null);
      setUpgradeUrl(null);
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
        if (!res.ok) {
          if (data.code === "limit_reached" && typeof data.upgradeUrl === "string") setUpgradeUrl(data.upgradeUrl);
          throw new Error(data.error || "Check failed");
        }
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
    <div className="relative min-h-screen overflow-x-clip">
      <div className="pointer-events-none absolute inset-0 bg-hero-radial" />
      <div className="pointer-events-none absolute -left-24 top-40 h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 top-24 h-80 w-80 rounded-full bg-accent-glow/15 blur-3xl" />

      {header}

      <main className="relative z-10 mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-6 sm:pt-14">
        <section className="mx-auto max-w-3xl text-center">
          <h1 className="text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl md:text-6xl">
            One handle.{" "}
            <span className="bg-gradient-to-r from-accent-soft via-white to-accent-glow bg-clip-text text-transparent">
              Everywhere that matters.
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-balance text-base leading-relaxed text-slate-400 sm:text-lg">
            <span className="sm:hidden">Available, Taken, or Unknown — no guessing.</span>
            <span className="hidden sm:inline">
              Check availability across gaming and social — Available, Taken, or Unknown. No guessing.
            </span>
          </p>

          <form
            onSubmit={onSubmit}
            className="sticky top-0 z-30 -mx-4 mt-8 flex max-w-2xl gap-2 bg-ink-950/85 px-4 py-3 backdrop-blur sm:static sm:mx-auto sm:mt-10 sm:gap-3 sm:bg-transparent sm:px-0 sm:py-0 sm:backdrop-blur-none"
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
                placeholder="Type a handle to see where it's free"
                autoComplete="off"
                spellCheck={false}
                className="h-12 w-full rounded-2xl sm:h-14 border border-white/10 bg-ink-800/80 pl-10 pr-4 text-base text-white shadow-card outline-none ring-0 placeholder:text-slate-500 transition focus:border-accent/60 focus:ring-2 focus:ring-accent/40"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !username.trim()}
              className="inline-flex h-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-r from-accent to-accent-glow px-5 sm:h-14 sm:px-8 text-sm font-semibold text-white shadow-glow transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Checking…" : "Check"}
            </button>
          </form>

          {recentSearches.length > 0 ? (
            <div className="mx-auto mt-4 max-w-2xl">
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
            className={`mx-auto mt-8 flex max-w-2xl flex-col gap-3 rounded-2xl border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between ${
              upgradeUrl ? "border-accent/30 bg-accent/10 text-slate-200" : "border-rose-500/30 bg-rose-500/10 text-rose-200"
            }`}
          >
            <span>{error}</span>
            {upgradeUrl ? (
              <a
                href={upgradeUrl}
                className="shrink-0 rounded-xl bg-gradient-to-r from-accent to-accent-glow px-4 py-2 text-center text-sm font-semibold text-white shadow-glow hover:brightness-110"
              >
                {upgradeUrl === "/signup" ? "Create free account" : "See plans"}
              </a>
            ) : null}
          </div>
        ) : null}

        {(loading || results) && (
          <section className="mt-10 space-y-6 sm:mt-12 sm:space-y-8">
            <div className="rounded-2xl border border-white/10 bg-ink-900/70 p-4 shadow-card backdrop-blur">
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
                  <a
                    href={`/tools/export?username=${encodeURIComponent(checkedUsername ?? "")}`}
                    className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-300 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    Export CSV
                  </a>
                  <a
                    href={`/tools/suggestions`}
                    className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-300 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    Find alternatives
                  </a>
                </div>
                {loading ? (
                  <p className="mt-2 text-sm text-slate-400">
                    Querying platforms… unclear answers are retried automatically.
                  </p>
                ) : null}
              </div>
            </div>

            {!loading && results ? (
              <div
                className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0"
                role="group"
                aria-label="Filter results by status"
              >
                {FILTERS.map((f) => {
                  const active = filter === f.id;
                  const count = f.id === "all" ? results.length : summary[f.id];
                  if (f.id === "invalid" && count === 0) return null;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFilter(f.id)}
                      aria-pressed={active}
                      className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                        active
                          ? "bg-accent text-white shadow-glow"
                          : "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                      }`}
                    >
                      {f.id !== "all" ? <span className={`h-1.5 w-1.5 rounded-full ${statusDotClass(f.id)}`} /> : null}
                      {f.label}
                      <span className={`tabular-nums ${active ? "text-white/80" : "text-slate-500"}`}>{count}</span>
                    </button>
                  );
                })}
              </div>
            ) : null}

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

        {!checkedUsername && !loading ? (
          <section aria-label="What Handle Hub does" className="mx-auto mt-24 max-w-5xl">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((f) => (
                <div key={f.title} className="rounded-2xl border border-white/10 bg-ink-800/50 p-5">
                  <h2 className="text-sm font-semibold text-white">{f.title}</h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{f.body}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {checkedUsername && !error ? <AllSites key={checkedUsername} username={checkedUsername} /> : null}
      </main>

      <footer className="relative z-10 border-t border-white/5 py-8 text-center text-xs text-slate-500">
        Handle Hub · availability probes never invent results ·{" "}
        <a href="/status" className="hover:text-slate-300">Platform health</a> · catalog data: WhatsMyName (CC BY-SA 4.0), Sherlock &amp; Maigret (MIT)
      </footer>
    </div>
  );
}
