import type { Metadata } from "next";
import { getPlatformHealth } from "@/lib/supabase/repo";
import { catalogStats } from "@/lib/engine/catalog";
import { StatusClient, type StatusRow } from "@/components/StatusClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Platform health — Handle Hub" };

function pct(n: number | null | undefined) {
  return n == null ? "—" : `${Math.round(n * 100)}%`;
}

export default async function StatusPage() {
  const rows = await getPlatformHealth();
  const stats = catalogStats();
  const core = rows.filter((r) => r.source === "adapter");
  const catalog = rows.filter((r) => r.source !== "adapter" && !r.nsfw);
  const enabled = catalog.filter((r) => r.enabled).length;
  const lastRun = rows.map((r) => r.lastSelftestAt).filter(Boolean).sort().pop();
  const compact: StatusRow[] = catalog.map((r) => ({
    id: r.id,
    n: r.name,
    c: r.category,
    s: r.source,
    e: r.enabled,
    h: r.healthScore,
    k: r.checks24h,
    u: r.unknownRate24h,
    note: r.notes?.slice(0, 80) ?? null,
  }));

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-hero-radial" />
      <main className="relative z-10 mx-auto max-w-6xl px-4 pb-20 pt-10 sm:px-6">
        <a href="/" className="text-xs text-slate-400 hover:text-white">← Handle Hub</a>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">Platform health</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Every catalog site is self-tested: its known account must come back <em>taken</em> and two random handles must come
          back <em>available</em>. Sites that fail are disabled automatically; NSFW sites are excluded. Last self-test:{" "}
          {lastRun ? new Date(lastRun).toUTCString() : "never"}.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Catalog sites (SFW)", catalog.length || stats.sites],
            ["Passing & enabled", enabled],
            ["Disabled", catalog.length - enabled],
            ["Core adapters", core.length],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-2xl border border-white/10 bg-ink-800/70 p-4 shadow-card">
              <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
              <p className="mt-1 text-2xl font-semibold text-white tabular-nums">{Number(value).toLocaleString()}</p>
            </div>
          ))}
        </div>

        <h2 className="mt-10 text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Core platforms</h2>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-white/10 bg-ink-900/70 shadow-card">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Platform</th>
                <th className="px-4 py-3">Self-test</th>
                <th className="px-4 py-3">Health</th>
                <th className="px-4 py-3">Checks 24h</th>
                <th className="px-4 py-3">Unknown 24h</th>
                <th className="px-4 py-3">Avg latency</th>
              </tr>
            </thead>
            <tbody>
              {core.map((r) => (
                <tr key={r.id} className="border-t border-white/5">
                  <td className="px-4 py-2.5 font-medium text-white">{r.name}</td>
                  <td className="px-4 py-2.5">
                    {r.selftestPassed == null ? (
                      <span className="text-slate-500">—</span>
                    ) : r.selftestPassed ? (
                      <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-300">pass</span>
                    ) : (
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-300">degraded</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-slate-300">{pct(r.healthScore)}</td>
                  <td className="px-4 py-2.5 tabular-nums text-slate-300">{r.checks24h}</td>
                  <td className="px-4 py-2.5 tabular-nums text-slate-300">{pct(r.unknownRate24h)}</td>
                  <td className="px-4 py-2.5 tabular-nums text-slate-300">{r.avgLatencyMs24h != null ? `${r.avgLatencyMs24h} ms` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="mt-10 text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Catalog sites</h2>
        <StatusClient rows={compact} />
      </main>
    </div>
  );
}
