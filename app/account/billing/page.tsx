import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountLayout } from "@/components/account/AccountLayout";
import { ui } from "@/components/ui/styles";
import { getCurrentUser } from "@/lib/supabase/ssr";
import { getAccountPlan } from "@/lib/usage";
import { PLANS, PLAN_ORDER, planPrice, priceLabel } from "@/lib/plans";
import { billingEnabled } from "@/lib/billing";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Billing · Handle Hub" };

export default async function BillingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/billing");
  const planId = await getAccountPlan(user.id, user.email);
  const plan = PLANS[planId];
  const paidOpen = billingEnabled() && PLAN_ORDER.some((id) => id !== "free" && planPrice(id) !== null);

  return (
    <AccountLayout active="billing" plan={planId}>
      <h1 className={ui.h1}>Billing</h1>
      <p className={ui.sub}>Your plan and payments.</p>

      <section className={`${ui.card} mt-6`} aria-labelledby="bill-plan">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Current plan</p>
        <h2 id="bill-plan" className="mt-1 text-xl font-semibold text-white">
          {plan.name} <span className="text-sm font-normal text-slate-400">· {priceLabel(planId)}</span>
        </h2>
        <p className="mt-1 max-w-md text-sm text-slate-400">{plan.blurb}</p>
      </section>

      <section className={`${ui.card} mt-4`} aria-labelledby="bill-upgrade">
        <h2 id="bill-upgrade" className="text-sm font-semibold text-white">
          {paidOpen ? "Upgrade" : "Pricing coming soon"}
        </h2>
        <p className="mt-1 text-sm text-slate-400">
          {paidOpen
            ? "Pick a paid plan on the pricing page."
            : "Paid plans aren't open yet. Nothing is charged, and there's no card on file. You'll be able to upgrade here when Pro and Team launch."}
        </p>
        <a href="/pricing" className={`${ui.primary} mt-4 w-full sm:w-auto`}>
          See plans
        </a>
      </section>
    </AccountLayout>
  );
}
