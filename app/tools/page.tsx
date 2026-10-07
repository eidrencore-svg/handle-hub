import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { ui } from "@/components/ui/styles";
import { getViewer } from "@/lib/tools/viewer";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Tools · Handle Hub",
  description: "Bulk check, variant compare, suggestions, watchlist, domain check, CSV export, search history and the API.",
};

type Tool = { href: string; title: string; line: string; tier: "Free" | "Pro"; glyph: string };

/** One line per card: final copy from Prisma. */
const TOOLS: Tool[] = [
  { href: "/tools/bulk", title: "Bulk check", line: "Paste a list and check every name in one go.", tier: "Pro", glyph: "≡" },
  { href: "/tools/variants", title: "Variant compare", line: "See name, name_, name. and name1 side by side.", tier: "Pro", glyph: "⇄" },
  { href: "/tools/suggestions", title: "Suggestions", line: "Taken? Get close alternatives that are actually free.", tier: "Pro", glyph: "✦" },
  { href: "/tools/watchlist", title: "Watchlist", line: "Get an alert when a handle you want frees up.", tier: "Pro", glyph: "◉" },
  { href: "/tools/domains", title: "Domain check", line: "See whether .com, .gg and .io match your handle.", tier: "Free", glyph: "◎" },
  { href: "/tools/export", title: "CSV export", line: "Download any scan for your team or your records.", tier: "Pro", glyph: "↧" },
  { href: "/account/history", title: "Search history", line: "Pick up where you left off.", tier: "Free", glyph: "↺" },
  { href: "/docs/api", title: "API", line: "Put Handle Hub's checks inside your own app.", tier: "Pro", glyph: "{ }" },
];

export default async function ToolsPage() {
  const viewer = await getViewer();
  return (
    <PageShell width="max-w-5xl" plan={viewer.plan ?? undefined}>
      <h1 className={ui.h1}>Tools</h1>
      <p className={ui.sub}>Everything you need to pick a name and lock it down.</p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {TOOLS.map((t) => (
          <li key={t.href}>
            <a
              href={t.href}
              className="group flex h-full items-start gap-3 rounded-2xl border border-white/10 bg-ink-900/70 p-4 shadow-card transition hover:border-accent/40 hover:bg-ink-800/80 sm:flex-col sm:p-5"
            >
              <span
                aria-hidden
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/15 font-mono text-sm font-semibold text-accent-soft ring-1 ring-accent/30"
              >
                {t.glyph}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-white group-hover:text-accent-soft">{t.title}</span>
                  {t.tier === "Pro" ? (
                    <span className={ui.proBadge}>Pro</span>
                  ) : (
                    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300 ring-1 ring-emerald-500/30">
                      Free
                    </span>
                  )}
                </span>
                <span className="mt-1 block text-sm leading-relaxed text-slate-400">{t.line}</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
      {viewer.plan !== "pro" && viewer.plan !== "team" ? (
        <p className="mt-6 text-center text-sm text-slate-400">
          {viewer.signedIn ? "Free includes a small daily trial of the Pro tools." : "Create a free account to try the Pro tools."}{" "}
          <a href={viewer.signedIn ? "/pricing" : "/signup"} className={ui.link}>
            {viewer.signedIn ? "See plans" : "Sign up free"}
          </a>
        </p>
      ) : null}
    </PageShell>
  );
}
