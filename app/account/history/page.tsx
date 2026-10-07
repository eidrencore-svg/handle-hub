import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { ui } from "@/components/ui/styles";
import { createSupabaseServerClient, getCurrentUser } from "@/lib/supabase/ssr";
import { clearHistory } from "@/lib/historyActions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Search history · Handle Hub" };

const SOURCE: Record<string, { label: string; href: (h: string) => string }> = {
  check: { label: "Check", href: (h) => `/?username=${encodeURIComponent(h)}` },
  scan: { label: "Full scan", href: (h) => `/?username=${encodeURIComponent(h)}` },
  bulk: { label: "Bulk", href: () => "/tools/bulk" },
  variants: { label: "Variants", href: () => "/tools/variants" },
  suggestions: { label: "Suggestions", href: () => "/tools/suggestions" },
  domains: { label: "Domains", href: (h) => `/tools/domains?name=${encodeURIComponent(h)}` },
};

function when(iso: string) {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 24 * 60) return `${Math.round(mins / 60)}h ago`;
  return d.toLocaleDateString("en", { day: "numeric", month: "short" });
}

function summaryLine(source: string, s: Record<string, unknown>) {
  const n = (k: string) => (typeof s[k] === "number" ? (s[k] as number) : null);
  if (source === "bulk" || source === "variants" || source === "suggestions") {
    return `${n("handles") ?? "?"} handles · ${n("freeEverywhere") ?? 0} free everywhere`;
  }
  const parts = [
    n("available") !== null ? `${n("available")} available` : null,
    n("taken") !== null ? `${n("taken")} taken` : null,
    n("unknown") ? `${n("unknown")} couldn't verify` : null,
  ].filter(Boolean);
  return parts.join(" · ");
}

export default async function HistoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/history");
  const supabase = await createSupabaseServerClient();
  const { data } = supabase
    ? await supabase.from("search_history").select("id, handle, source, summary, created_at").order("created_at", { ascending: false }).limit(100)
    : { data: [] };
  const rows = data ?? [];

  return (
    <PageShell width="max-w-3xl">
      <a href="/account" className="text-xs text-slate-400 hover:text-white">
        ← Account
      </a>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div>
          <h1 className={ui.h1}>Search history</h1>
          <p className={ui.sub}>Pick up where you left off.</p>
        </div>
        {rows.length ? (
          <form action={clearHistory}>
            <button type="submit" className={ui.danger}>
              Clear
            </button>
          </form>
        ) : null}
      </div>
      {rows.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-white/10 bg-ink-800/50 px-4 py-10 text-center">
          <p className="text-sm text-slate-400">Nothing yet. Checks you run while logged in show up here.</p>
          <a href="/" className={`${ui.primary} mt-4`}>
            Check a handle
          </a>
        </div>
      ) : (
        <ul className="mt-6 divide-y divide-white/5 overflow-hidden rounded-2xl border border-white/10 bg-ink-900/70">
          {rows.map((r) => {
            const src = SOURCE[r.source] ?? SOURCE.check;
            return (
              <li key={r.id}>
                <a href={src.href(r.handle)} className="flex items-center justify-between gap-3 px-4 py-3 transition hover:bg-white/[0.03]">
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-white">@{r.handle}</span>
                      <span className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 ring-1 ring-white/10">
                        {src.label}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-slate-500">
                      {summaryLine(r.source, (r.summary as Record<string, unknown>) ?? {})}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-slate-500">{when(r.created_at)}</span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </PageShell>
  );
}
