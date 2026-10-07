"use client";

import { FormEvent, useState } from "react";
import { statusBadgeClasses, statusLabel } from "@/components/statusStyles";
import { ui } from "@/components/ui/styles";
import type { DomainResult } from "@/lib/tools/domains";

export function DomainsClient({ initial }: { initial?: string }) {
  const [name, setName] = useState(initial ?? "");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ label: string; changed: boolean; results: DomainResult[] } | null>(null);
  const [error, setError] = useState<{ message: string; upgradeUrl?: string } | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim().replace(/^@+/, "");
    if (!n) return;
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(`/api/tools/domains?name=${encodeURIComponent(n)}`);
      const json = await res.json();
      if (!res.ok) setError({ message: json.error ?? "Lookup failed.", upgradeUrl: json.upgradeUrl });
      else setData(json);
    } catch {
      setError({ message: "Lookup failed. Check your connection and try again." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <form onSubmit={onSubmit} className={`${ui.card} mt-6 flex flex-col gap-2 sm:flex-row`}>
        <label htmlFor="dname" className="sr-only">
          Name
        </label>
        <input
          id="dname"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="yourname"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          className={ui.input}
        />
        <button type="submit" disabled={loading || !name.trim()} className={`${ui.primary} shrink-0`}>
          {loading ? "Looking up…" : "Check domains"}
        </button>
      </form>
      {error ? (
        <div role="alert" className={`${ui.errorBox} mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between`}>
          <span>{error.message}</span>
          {error.upgradeUrl ? (
            <a href={error.upgradeUrl} className="shrink-0 font-semibold underline">
              {error.upgradeUrl === "/signup" ? "Create free account" : "See plans"}
            </a>
          ) : null}
        </div>
      ) : null}
      {loading ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl border border-white/10 bg-ink-800/40" />
          ))}
        </div>
      ) : null}
      {data ? (
        <section className="mt-6" aria-live="polite">
          {data.changed ? (
            <p className="mb-3 text-xs text-slate-400">
              Checked <span className="font-mono text-slate-200">{data.label}</span>: domains can&apos;t contain dots or underscores.
            </p>
          ) : null}
          <ul className="grid gap-3 sm:grid-cols-2">
            {data.results.map((r) => (
              <li key={r.tld} className="rounded-2xl border border-white/10 bg-ink-900/70 p-4 shadow-card">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 truncate font-mono text-base font-semibold text-white">{r.domain}</p>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClasses(r.status)}`}>{statusLabel(r.status)}</span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{r.message}</p>
                <div className="mt-3 flex items-center justify-between text-xs">
                  <span className="text-slate-600">{r.source ? `RDAP · ${r.source}` : ""}</span>
                  {r.actionUrl ? (
                    <a href={r.actionUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent-soft hover:text-white">
                      {r.status === "available" ? "Register" : r.status === "taken" ? "Visit" : "Check by hand"} →
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-center text-xs text-slate-500">
            Lookups use each registry&apos;s official RDAP service. Always confirm at a registrar before you buy.
          </p>
        </section>
      ) : null}
    </>
  );
}
