import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { UsageMeter } from "@/components/UsageMeter";
import { ui } from "@/components/ui/styles";
import { getCurrentUser } from "@/lib/supabase/ssr";
import { getAccountPlan, getUsageToday } from "@/lib/usage";
import { PLANS, priceLabel } from "@/lib/plans";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your account · Handle Hub" };

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");
  const planId = await getAccountPlan(user.id, user.email);
  const plan = PLANS[planId];
  const usage = await getUsageToday(`u:${user.id}`);
  const since = user.createdAt ? new Date(user.createdAt).toLocaleDateString("en", { month: "short", year: "numeric" }) : null;

  return (
    <PageShell width="max-w-3xl" plan={planId}>
      <h1 className={ui.h1}>Your account</h1>
      <p className={`${ui.sub} break-all`}>
        {user.email}
        {since ? ` · member since ${since}` : ""}
      </p>

      <section className={`${ui.card} mt-6`} aria-labelledby="plan-h">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Current plan</p>
            <h2 id="plan-h" className="mt-1 text-xl font-semibold text-white">
              {plan.name} <span className="text-sm font-normal text-slate-400">· {priceLabel(planId)}</span>
            </h2>
            <p className="mt-1 max-w-md text-sm text-slate-400">{plan.blurb}</p>
          </div>
          {planId === "free" ? (
            <a href="/pricing" className={`${ui.primary} w-full sm:w-auto`}>
              See plans
            </a>
          ) : null}
        </div>
        <div className="mt-6">
          <p className="mb-3 text-xs font-medium uppercase tracking-wider text-slate-500">Today&apos;s usage · resets at midnight UTC</p>
          <UsageMeter usage={usage} limits={plan.limits} />
        </div>
      </section>

      <section className="mt-4 grid gap-3 sm:grid-cols-3">
        {[
          { href: "/account/api-keys", title: "API keys", body: "Create and revoke keys for the REST API." },
          { href: "/account/history", title: "Search history", body: "Pick up where you left off." },
          { href: "/tools/watchlist", title: "Watchlist", body: "Get an alert when a handle frees up." },
        ].map((c) => (
          <a key={c.href} href={c.href} className={`${ui.cardMuted} block transition hover:border-accent/40 hover:bg-ink-800/80`}>
            <h3 className="text-sm font-semibold text-white">{c.title}</h3>
            <p className="mt-1 text-sm text-slate-400">{c.body}</p>
          </a>
        ))}
      </section>

      <section className={`${ui.card} mt-4`}>
        <h2 className="text-sm font-semibold text-white">Security</h2>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <a href="/account/reset-password" className={ui.secondary}>
            Change password
          </a>
          <form action="/auth/signout" method="post">
            <button type="submit" className={`${ui.secondary} w-full sm:w-auto`}>
              Log out
            </button>
          </form>
        </div>
      </section>
    </PageShell>
  );
}
