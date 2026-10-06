"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { statusBadgeClasses } from "@/components/statusStyles";

type ScanItem = {
  site: string;
  name: string;
  category: string;
  status: "taken" | "available" | "unknown" | "invalid";
  profileUrl?: string;
  claimUrl?: string;
  urlMain?: string;
  reason?: string;
  latencyMs: number;
  cached?: boolean;
};

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "social", label: "Social" },
  { id: "gaming", label: "Gaming" },
  { id: "dev", label: "Dev" },
  { id: "creative", label: "Creative" },
  { id: "business", label: "Business" },
  { id: "community", label: "Community" },
  { id: "other", label: "Other" },
] as const;
const STATUSES = ["all", "taken", "available", "unknown"] as const;
const ORDER: Record<string, number> = { taken: 0, available: 1, unknown: 2, invalid: 3 };
const PAGE = 120;

function hostLabel(url?: string) {
  try {
    return url ? new URL(url).hostname.replace(/^www\./, "") : "";
  } catch {
    return "";
  }
}

export function AllSites({ username }: { username: string }) {
  const [items, setItems] = useState<Map<string, ScanItem>>(new Map());
  const [total, setTotal] = useState(0);
  const [phase, setPhase] = useState<"connecting" | "scanning" | "done" | "error">("connecting");
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]["id"]>("all");
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("all");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const buffer = useRef<ScanItem[]>([]);

  useEffect(() => {
    setItems(new Map());
    setTotal(0);
    setPhase("connecting");
    setError(null);
    setDurationMs(null);
    setLimit(PAGE);
    buffer.current = [];
    const es = new EventSource(`/api/scan?username=${encodeURIComponent(username)}`);
    // Batch DOM updates: flush buffered results ~6x/sec.
    const flush = window.setInterval(() => {
      if (!buffer.current.length) return;
      const batch = buffer.current.splice(0);
      setItems((prev) => {
        const next = new Map(prev);
        for (const it of batch) next.set(it.site, it);
        return next;
      });
    }, 160);
    es.addEventListener("meta", (e) => {
      const d = JSON.parse((e as MessageEvent).data);
      setTotal(d.total);
      setPhase("scanning");
    });
    es.addEventListener("result", (e) => buffer.current.push(JSON.parse((e as MessageEvent).data)));
    es.addEventListener("done", (e) => {
      const d = JSON.parse((e as MessageEvent).data);
      setDurationMs(d.durationMs);
      setPhase("done");
      es.close();
    });
    es.onerror = () => {
      es.close();
      setPhase((p) => (p === "done" ? p : "error"));
      setError("Scan stream interrupted — partial results shown.");
    };
    return () => {
      es.close();
      window.clearInterval(flush);
      const batch = buffer.current.splice(0);
      if (batch.length) setItems((prev) => new Map([...prev, ...batch.map((b) => [b.site, b] as const)]));
    };
  }, [username]);

  const all = useMemo(() => [...items.values()], [items]);
  const counts = useMemo(() => {
    const c = { taken: 0, available: 0, unknown: 0, invalid: 0 };
    for (const i of all) c[i.status] = (c[i.status] ?? 0) + 1;
    return c;
  }, [all]);
  const catCounts = useMemo(() => {
    const m: Record<string, number> = { all: all.length };
    for (const i of all) m[i.category] = (m[i.category] ?? 0) + 1;
    return m;
  }, [all]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all
      .filter((i) => (category === "all" || i.category === category) && (status === "all" || i.status === status))
      .filter((i) => !q || i.name.toLowerCase().includes(q) || hostLabel(i.urlMain).includes(q))
      .sort((a, b) => ORDER[a.status] - ORDER[b.status] || a.name.localeCompare(b.name));
  }, [all, category, status, query]);

  const checked = all.length;
  const pct = total ? Math.min(100, Math.round((checked / total) * 100)) : 0;

  return (
    <section className="mt-14" aria-labelledby="all-sites-heading">
      <div className="rounded-2xl border border-white/10 bg-ink-900/70 p-4 shadow-card backdrop-blur sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="all-sites-heading" className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
              All sites
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Self-tested catalog from WhatsMyName, Sherlock &amp; Maigret ·{" "}
              <a href="/status" className="text-accent-soft hover:underline">health</a>
            </p>
          </div>
          <p className="text-sm text-slate-300" aria-live="polite">
            <span className="font-semibold text-white">{checked.toLocaleString()}</span>
            <span className="text-slate-500"> / {total ? total.toLocaleString() : "…"} sites checked</span>
            {phase === "done" && durationMs != null ? (
              <span className="text-slate-500"> · {(durationMs / 1000).toFixed(1)}s</span>
            ) : null}
          </p>
        </div>

        <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/5" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <div
            className={`h-full rounded-full bg-gradient-to-r from-accent to-accent-glow transition-[width] duration-300 ${phase === "scanning" || phase === "connecting" ? "animate-pulse" : ""}`}
            style={{ width: `${phase === "done" ? 100 : pct}%` }}
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <span className="font-medium text-rose-300">{counts.taken} taken</span>
          <span className="font-medium text-emerald-300">{counts.available} available</span>
          <span className="font-medium text-slate-300">{counts.unknown} unknown</span>
          {counts.invalid ? <span className="font-medium text-amber-300">{counts.invalid} not allowed</span> : null}
          {error ? <span className="text-amber-300">{error}</span> : null}
        </div>

        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Categories">
            {CATEGORIES.map((c) => {
              const active = category === c.id;
              return (
                <button
                  key={c.id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setCategory(c.id);
                    setLimit(PAGE);
                  }}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                    active ? "bg-accent text-white shadow-glow" : "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                  }`}
                >
                  {c.label}
                  <span className={`ml-1.5 tabular-nums ${active ? "text-white/80" : "text-slate-500"}`}>{catCounts[c.id] ?? 0}</span>
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as (typeof STATUSES)[number])}
              aria-label="Filter by status"
              className="h-9 rounded-xl border border-white/10 bg-ink-800/80 px-3 text-xs font-medium capitalize text-slate-200 outline-none focus:ring-2 focus:ring-accent/40"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s === "all" ? "Any status" : s}
                </option>
              ))}
            </select>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter sites…"
              aria-label="Filter sites by name"
              className="h-9 w-44 rounded-xl border border-white/10 bg-ink-800/80 px-3 text-xs text-white outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-accent/40"
            />
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {visible.slice(0, limit).map((i) => (
          <div
            key={i.site}
            className="flex items-center justify-between gap-2 rounded-xl border border-white/5 bg-ink-800/60 px-3 py-2.5 transition hover:border-accent/30"
            title={i.reason ? `${i.name}: ${i.reason}` : i.name}
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-100">{i.name}</p>
              <p className="truncate text-[11px] text-slate-500">
                {hostLabel(i.urlMain)}
                {i.cached ? " · cached" : ""}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {i.status === "taken" && i.profileUrl ? (
                <a href={i.profileUrl} target="_blank" rel="noreferrer nofollow" className="text-[11px] font-medium text-accent-soft hover:underline">
                  Profile
                </a>
              ) : null}
              {i.status === "available" && i.claimUrl ? (
                <a href={i.claimUrl} target="_blank" rel="noreferrer nofollow" className="text-[11px] text-emerald-300/70 hover:text-emerald-200 hover:underline">
                  Claim
                </a>
              ) : null}
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${statusBadgeClasses(i.status)}`}>
                {i.status === "invalid" ? "n/a" : i.status}
              </span>
            </div>
          </div>
        ))}
        {phase !== "done" && visible.length < 8
          ? Array.from({ length: 8 - visible.length }).map((_, k) => (
              <div key={`sk-${k}`} className="h-[54px] animate-pulse rounded-xl border border-white/5 bg-ink-800/40" />
            ))
          : null}
      </div>

      {visible.length > limit ? (
        <div className="mt-4 text-center">
          <button
            onClick={() => setLimit((l) => l + PAGE * 2)}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10"
          >
            Show more ({(visible.length - limit).toLocaleString()} hidden)
          </button>
        </div>
      ) : null}
      {phase === "done" && visible.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-white/10 bg-ink-800/50 px-4 py-8 text-center text-sm text-slate-400">No sites match these filters.</p>
      ) : null}
    </section>
  );
}
