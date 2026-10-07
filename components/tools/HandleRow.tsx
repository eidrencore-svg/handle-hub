"use client";

import { PlatformIcon } from "@/components/PlatformIcon";
import { CLAIM_URLS, statusDotClass, statusLabel, statusTextClass } from "@/components/statusStyles";
import type { ToolRow } from "./useToolRun";

export function rowCounts(row: ToolRow) {
  const c = { available: 0, taken: 0, unknown: 0, invalid: 0 };
  for (const r of row.results) c[r.status] = (c[r.status] ?? 0) + 1;
  return c;
}

/** One handle × the selected core platforms: compact, phone-first grid of status cells. */
export function HandleRow({ row, highlight }: { row: ToolRow; highlight?: boolean }) {
  const c = rowCounts(row);
  const n = row.results.length;
  const everywhere = n > 0 && c.available === n;
  return (
    <article
      className={`rounded-2xl border p-4 shadow-card ${
        highlight || everywhere ? "border-emerald-500/40 bg-emerald-500/[0.06]" : "border-white/10 bg-ink-900/70"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <a href={`/?username=${encodeURIComponent(row.handle)}`} className="min-w-0 truncate text-base font-semibold text-white hover:text-accent-soft">
          @{row.handle}
        </a>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
            everywhere ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30" : "bg-white/5 text-slate-300 ring-1 ring-white/10"
          }`}
        >
          {row.error ? "Couldn't check" : everywhere ? `Available on all ${n}` : `Available on ${c.available}/${n}`}
        </span>
      </div>
      {row.error ? <p className="mt-2 text-xs text-amber-200">{row.error}</p> : null}
      <ul className="mt-3 grid grid-cols-5 gap-1.5 sm:grid-cols-10">
        {row.results.map((r) => {
          const href =
            r.status === "taken" ? r.profileUrl ?? r.checkUrl : r.status === "available" ? CLAIM_URLS[r.platformId] ?? r.checkUrl : r.checkUrl;
          const title = `${r.platformName}: ${statusLabel(r.status)}${r.userMessage ? ` · ${r.userMessage}` : ""}`;
          const inner = (
            <>
              <span className="relative">
                <PlatformIcon platformId={r.platformId} className="h-5 w-5" />
                <span className={`absolute -bottom-0.5 -right-1 h-2.5 w-2.5 rounded-full ring-2 ring-ink-900 ${statusDotClass(r.status)}`} />
              </span>
              <span className={`mt-1 text-[10px] font-semibold leading-none ${statusTextClass(r.status)}`}>
                {r.status === "unknown" ? "Unclear" : statusLabel(r.status)}
              </span>
            </>
          );
          return (
            <li key={r.platformId}>
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={title}
                  aria-label={title}
                  className="flex flex-col items-center rounded-xl bg-white/[0.03] px-1 py-2 ring-1 ring-white/5 transition hover:bg-white/[0.07]"
                >
                  {inner}
                </a>
              ) : (
                <div title={title} aria-label={title} className="flex flex-col items-center rounded-xl bg-white/[0.03] px-1 py-2 ring-1 ring-white/5">
                  {inner}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </article>
  );
}

export function RowSkeleton() {
  return <div className="h-[118px] animate-pulse rounded-2xl border border-white/10 bg-ink-800/40" />;
}
