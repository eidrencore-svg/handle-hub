"use client";

import { downloadCsv, toCsv } from "@/lib/csv";
import { statusLabel } from "@/components/statusStyles";
import { HandleRow, RowSkeleton, rowCounts } from "./HandleRow";
import type { ToolRow } from "./useToolRun";

/** Results list + progress + CSV button shared by bulk / variants / suggestions. */
export function ToolResults({
  rows,
  total,
  running,
  durationMs,
  csvExport,
  filename,
  sort,
  order,
}: {
  rows: ToolRow[];
  total: number;
  running: boolean;
  durationMs: number | null;
  csvExport: boolean;
  filename: string;
  sort?: "availability" | "input";
  /** Input order of handles (results stream in completion order). */
  order?: string[];
}) {
  if (!running && rows.length === 0) return null;
  const ordered =
    sort === "availability"
      ? [...rows].sort((a, b) => rowCounts(b).available - rowCounts(a).available || a.handle.localeCompare(b.handle))
      : order
        ? [...rows].sort((a, b) => order.indexOf(a.handle) - order.indexOf(b.handle))
        : rows;
  const everywhere = rows.filter((r) => r.results.length && rowCounts(r).available === r.results.length).length;

  const exportCsv = () => {
    const csv = toCsv(
      ["handle", "platform_id", "platform", "status", "status_label", "reason", "profile_url"],
      rows.flatMap((r) => r.results.map((c) => [r.handle, c.platformId, c.platformName, c.status, statusLabel(c.status), c.reason, c.profileUrl]))
    );
    downloadCsv(`${filename}-${new Date().toISOString().slice(0, 10)}.csv`, csv);
  };

  return (
    <section className="mt-8 space-y-3" aria-live="polite">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-400">
          {running ? (
            <>
              Checking <span className="font-semibold text-white">{rows.length}</span> of {total} handles…
            </>
          ) : (
            <>
              <span className="font-semibold text-emerald-300">{everywhere}</span> of {rows.length} available on every platform you picked
              {durationMs != null ? <span className="text-slate-500"> · {(durationMs / 1000).toFixed(1)}s</span> : null}
            </>
          )}
        </p>
        {!running && rows.length ? (
          csvExport ? (
            <button type="button" onClick={exportCsv} className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/10">
              Export CSV
            </button>
          ) : (
            <a href="/pricing" className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white">
              Export CSV · Pro
            </a>
          )
        ) : null}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
        <div
          className={`h-full rounded-full bg-gradient-to-r from-accent to-accent-glow transition-[width] ${running ? "animate-pulse" : ""}`}
          style={{ width: `${total ? Math.round((rows.length / total) * 100) : 0}%` }}
        />
      </div>
      <div className="space-y-3">
        {ordered.map((r) => (
          <HandleRow key={r.handle} row={r} />
        ))}
        {running ? Array.from({ length: Math.min(2, Math.max(0, total - rows.length)) }).map((_, i) => <RowSkeleton key={i} />) : null}
      </div>
      <p className="pt-2 text-center text-xs text-slate-500">
        Unclear = Couldn&apos;t verify. Tap a platform to open it. Always confirm on the platform before you commit.
      </p>
    </section>
  );
}
