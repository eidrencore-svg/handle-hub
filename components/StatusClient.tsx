"use client";

import { useMemo, useState } from "react";

export type StatusRow = {
  id: string;
  n: string;
  c: string;
  s: string;
  e: boolean;
  h: number | null;
  k: number;
  u: number | null;
  note: string | null;
};

const PAGE = 150;

export function StatusClient({ rows }: { rows: StatusRow[] }) {
  const [q, setQ] = useState("");
  const [show, setShow] = useState<"enabled" | "disabled" | "all">("enabled");
  const [limit, setLimit] = useState(PAGE);

  const byCat = useMemo(() => {
    const m = new Map<string, { on: number; total: number }>();
    for (const r of rows) {
      const v = m.get(r.c) ?? { on: 0, total: 0 };
      v.total++;
      if (r.e) v.on++;
      m.set(r.c, v);
    }
    return [...m.entries()].sort((a, b) => b[1].total - a[1].total);
  }, [rows]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows
      .filter((r) => (show === "all" ? true : show === "enabled" ? r.e : !r.e))
      .filter((r) => !needle || r.n.toLowerCase().includes(needle) || r.id.includes(needle))
      .sort((a, b) => a.n.localeCompare(b.n));
  }, [rows, q, show]);

  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        {byCat.map(([cat, v]) => (
          <span key={cat} className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs capitalize text-slate-300">
            {cat} <span className="tabular-nums text-emerald-300">{v.on}</span>
            <span className="text-slate-500">/{v.total}</span>
          </span>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {(["enabled", "disabled", "all"] as const).map((k) => (
          <button
            key={k}
            onClick={() => {
              setShow(k);
              setLimit(PAGE);
            }}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold capitalize ${show === k ? "bg-accent text-white shadow-glow" : "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"}`}
          >
            {k}
          </button>
        ))}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search sites…"
          className="h-8 w-48 rounded-xl border border-white/10 bg-ink-800/80 px-3 text-xs text-white outline-none placeholder:text-slate-500 focus:ring-2 focus:ring-accent/40"
        />
        <span className="self-center text-xs text-slate-500">{list.length.toLocaleString()} sites</span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {list.slice(0, limit).map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-2 rounded-xl border border-white/5 bg-ink-800/60 px-3 py-2" title={r.note ?? undefined}>
            <div className="min-w-0">
              <p className="truncate text-sm text-slate-100">{r.n}</p>
              <p className="truncate text-[11px] text-slate-500">
                {r.c} · {r.s}
                {r.k ? ` · ${r.k} checks/24h` : ""}
                {!r.e && r.note ? ` · ${r.note.replace(/^self-test failed: /, "")}` : ""}
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${r.e ? "bg-emerald-500/15 text-emerald-300" : "bg-slate-500/15 text-slate-400"}`}
            >
              {r.e ? (r.h != null ? `${Math.round(r.h * 100)}%` : "on") : "off"}
            </span>
          </div>
        ))}
      </div>
      {list.length > limit ? (
        <div className="mt-4 text-center">
          <button onClick={() => setLimit((l) => l + PAGE * 2)} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-white/10">
            Show more
          </button>
        </div>
      ) : null}
    </div>
  );
}
