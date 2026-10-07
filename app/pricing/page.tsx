import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { ui } from "@/components/ui/styles";
import { getCurrentUser } from "@/lib/supabase/ssr";
import { getAccountPlan } from "@/lib/usage";
import { ANON_LIMITS, PLANS, PLAN_ORDER, priceLabel, type Limits, type PlanId } from "@/lib/plans";
import { canCheckout } from "@/lib/billing";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Pricing · Handle Hub",
  description: "Start free. Upgrade when you're checking at scale.",
};

const n = (v: number | null) => (v === null ? "Unlimited" : v === 0 ? "—" : v.toLocaleString());
const ROWS: { label: string; get: (l: Limits) => string }[] = [
  { label: "Core checks / day", get: (l) => n(l.coreChecksPerDay) },
  { label: "Full scans / day", get: (l) => n(l.fullScansPerDay) },
  { label: "Bulk, variants, suggestions", get: (l) => (l.toolRunsPerDay === null ? "Unlimited" : l.toolRunsPerDay ? `${l.toolRunsPerDay} runs/day trial` : "—") },
  { label: "Handles per bulk check", get: (l) => n(l.bulkMaxHandles) },
  { label: "Watchlist", get: (l) => n(l.watchlistSlots) },
  { label: "CSV export", get: (l) => (l.csvExport ? "Yes" : "—") },
  { label: "API requests / day", get: (l) => n(l.apiPerDay) },
];

export default async function PricingPage() {
  const user = await getCurrentUser();
  const current: PlanId | null = user ? await getAccountPlan(user.id, user.email) : null;

  return (
    <PageShell width="max-w-6xl" plan={current ?? undefined}>
      <section className="mx-auto max-w-2xl text-center">
        <h1 className="text-balance text-3xl font-semibold tracking-tight text-white sm:text-5xl">
          Claim your name before someone else does.
        </h1>
        <p className="mt-3 text-balance text-base text-slate-400 sm:text-lg">Start free. Upgrade when you&apos;re checking at scale.</p>
      </section>

      <section className="mt-10 grid gap-4 md:grid-cols-3" aria-label="Plans">
        {PLAN_ORDER.map((id) => {
          const plan = PLANS[id];
          const isCurrent = current === id;
          const price = priceLabel(id);
          return (
            <article
              key={id}
              className={`relative flex flex-col rounded-2xl border p-5 shadow-card sm:p-6 ${
                plan.highlight ? "border-accent/50 bg-ink-900/90 ring-1 ring-accent/30" : "border-white/10 bg-ink-900/70"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold text-white">{plan.name}</h2>
                {isCurrent ? (
                  <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-300 ring-1 ring-emerald-500/30">
                    Your plan
                  </span>
                ) : plan.highlight ? (
                  <span className={ui.proBadge}>Most popular</span>
                ) : null}
              </div>
              <p className={`mt-3 font-semibold tracking-tight text-white ${price.startsWith("$") ? "text-3xl" : "text-lg text-slate-300"}`}>
                {price}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">{plan.blurb}</p>
              <ul className="mt-5 flex-1 space-y-2.5 text-sm text-slate-300">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" aria-hidden />
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                {id === "free" ? (
                  user ? (
                    <a href="/tools" className={`${ui.secondary} w-full`}>
                      {isCurrent ? "Open the tools" : "Included"}
                    </a>
                  ) : (
                    <a href="/signup" className={`${ui.primary} w-full`}>
                      Create free account
                    </a>
                  )
                ) : isCurrent ? (
                  <a href="/account" className={`${ui.secondary} w-full`}>
                    Manage plan
                  </a>
                ) : canCheckout(id) ? (
                  <a href={`/api/billing/checkout?plan=${id}`} className={`${ui.primary} w-full`}>
                    Upgrade to {plan.name}
                  </a>
                ) : (
                  <button type="button" disabled className={`${ui.primary} w-full`} aria-describedby="billing-note">
                    Upgrade · coming soon
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </section>

      <p id="billing-note" className="mt-4 text-center text-xs text-slate-500">
        Paid plans open soon. Create a free account now and you&apos;ll be first to upgrade.
      </p>

      <section className="mt-12" aria-labelledby="compare">
        <h2 id="compare" className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
          Compare limits
        </h2>
        <div className="-mx-4 mt-3 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[520px] border-separate border-spacing-0 overflow-hidden rounded-2xl border border-white/10 text-sm">
            <thead>
              <tr className="bg-ink-800/70 text-left text-xs uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3 font-medium">Limit</th>
                <th className="px-4 py-3 font-medium">No account</th>
                {PLAN_ORDER.map((id) => (
                  <th key={id} className="px-4 py-3 font-medium">
                    {PLANS[id].name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.label} className="border-t border-white/5 odd:bg-ink-900/40">
                  <td className="px-4 py-2.5 text-slate-300">{r.label}</td>
                  <td className="px-4 py-2.5 tabular-nums text-slate-500">{r.get(ANON_LIMITS)}</td>
                  {PLAN_ORDER.map((id) => (
                    <td key={id} className="px-4 py-2.5 tabular-nums text-slate-200">
                      {r.get(PLANS[id].limits)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="mx-auto mt-10 max-w-xl text-center text-xs leading-relaxed text-slate-500">
        Results are based on public signals. Always confirm on the platform before you commit.
      </p>
    </PageShell>
  );
}
