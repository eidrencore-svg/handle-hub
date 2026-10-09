/**
 * Billing stub. Stripe is NOT connected yet: every Upgrade button shows
 * "Coming soon" until STRIPE_SECRET_KEY (and the price IDs) are set and the
 * checkout below is implemented.
 *
 * To turn on Stripe Checkout (test mode first):
 *   1. The owner creates a Stripe account and Products/Prices for Pro and Team.
 *   2. Set STRIPE_SECRET_KEY (sk_test_…), STRIPE_PRICE_PRO, STRIPE_PRICE_TEAM,
 *      STRIPE_WEBHOOK_SECRET on the server.
 *   3. `npm i stripe`, implement createCheckoutSession() with
 *      stripe.checkout.sessions.create({ mode: "subscription", ... }) and add a
 *      webhook route that sets accounts.plan / stripe_customer_id with the
 *      service role on checkout.session.completed / customer.subscription.*.
 */
import type { PlanId } from "./plans";
import { planPrice } from "./plans";

export function billingEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

function stripePriceId(plan: PlanId): string | null {
  if (plan === "pro") return process.env.STRIPE_PRICE_PRO?.trim() || null;
  if (plan === "team") return process.env.STRIPE_PRICE_TEAM?.trim() || null;
  return null;
}

/** True only when Stripe is configured AND the plan has an approved price + Stripe price ID. */
export function canCheckout(plan: PlanId): boolean {
  return billingEnabled() && planPrice(plan) !== null && stripePriceId(plan) !== null;
}

export class BillingNotConfiguredError extends Error {
  constructor() {
    super("Billing isn't set up yet.");
  }
}

/** Returns a Stripe Checkout URL. Not implemented until Stripe is connected. */
export async function createCheckoutSession(_input: {
  plan: PlanId;
  userId: string;
  email: string | null;
  origin: string;
}): Promise<string> {
  if (!canCheckout(_input.plan)) throw new BillingNotConfiguredError();
  // Implement with the Stripe SDK once the owner connects their account (test mode first).
  throw new BillingNotConfiguredError();
}
