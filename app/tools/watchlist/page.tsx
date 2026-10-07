import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { ToolHeader } from "@/components/tools/ToolHeader";
import { Gate } from "@/components/tools/Gate";
import { WatchForm } from "@/components/tools/WatchForm";
import { PlatformIcon } from "@/components/PlatformIcon";
import { statusBadgeClasses, statusLabel } from "@/components/statusStyles";
import { ui } from "@/components/ui/styles";
import { createSupabaseServerClient } from "@/lib/supabase/ssr";
import { getViewer } from "@/lib/tools/viewer";
import { removeWatch } from "@/lib/watchlist/actions";
import { corePlatformName } from "@/lib/platforms/coreList";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Watchlist · Handle Hub" };

const ago = (iso: string | null) => {
  if (!iso) return "not checked yet";
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return m < 60 ? `checked ${m}m ago` : m < 1440 ? `checked ${Math.round(m / 60)}h ago` : `checked ${Math.round(m / 1440)}d ago`;
};

export default async function WatchlistPage() {
  const viewer = await getViewer();
  const supabase = viewer.signedIn ? await createSupabaseServerClient() : null;
  const { data } = supabase
    ? await supabase
        .from("watchlist")
        .select("id, handle, platform_id, last_status, last_checked_at, freed_at")
        .order("created_at", { ascending: false })
    : { data: [] };
  const items = data ?? [];
  const slots = viewer.limits.watchlistSlots;

  return (
    <PageShell width="max-w-3xl" plan={viewer.plan ?? undefined}>
      <ToolHeader title="Watchlist" line="Get an alert when a handle you want frees up." pro />
      <div className="mt-6 space-y-3">
        {!viewer.signedIn ? <Gate kind="login" feature="the watchlist" next="/tools/watchlist" /> : slots === 0 ? <Gate kind="pro" feature="The watchlist" /> : null}
        <p className={ui.noteBox}>
          We re-check watched handles every few hours and mark them the moment a real check comes back Available. Email alerts are coming
          soon; for now, freed handles are flagged here.
        </p>
      </div>

      <section className={`${ui.card} mt-4`}>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-white">Add a handle</h2>
          {viewer.signedIn ? (
            <span className="text-xs tabular-nums text-slate-500">
              {items.length} / {slots} slots
            </span>
          ) : null}
        </div>
        <WatchForm disabled={!viewer.signedIn || slots === 0 || items.length >= slots} />
      </section>

      {items.length ? (
        <ul className="mt-6 space-y-2">
          {items.map((it) => (
            <li
              key={it.id}
              className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${
                it.freed_at ? "border-emerald-500/40 bg-emerald-500/[0.07]" : "border-white/10 bg-ink-900/70"
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <PlatformIcon platformId={it.platform_id} className="h-5 w-5 shrink-0" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">
                    @{it.handle} <span className="font-normal text-slate-500">on {corePlatformName(it.platform_id)}</span>
                  </p>
                  <p className="text-xs text-slate-500">{it.freed_at ? `Freed up ${new Date(it.freed_at).toLocaleDateString("en", { day: "numeric", month: "short" })}` : ago(it.last_checked_at)}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClasses(it.last_status ?? "unknown")}`}>
                  {statusLabel(it.last_status ?? "unknown")}
                </span>
                <form action={removeWatch}>
                  <input type="hidden" name="id" value={it.id} />
                  <button type="submit" aria-label={`Stop watching @${it.handle} on ${corePlatformName(it.platform_id)}`} className="rounded-lg px-2 py-1 text-lg leading-none text-slate-500 hover:bg-white/5 hover:text-white">
                    ×
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </PageShell>
  );
}
