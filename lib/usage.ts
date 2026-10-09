/**
 * Who is calling (signed-in account or anonymous IP hash), their plan, and
 * daily usage enforcement backed by public.usage_counters / consume_usage().
 * If Supabase is unreachable we fail open (the in-memory per-minute limits
 * in lib/rateLimit.ts still apply) rather than blocking every check.
 */
import { cache } from "react";
import { getCurrentUser } from "@/lib/supabase/ssr";
import { getServiceSupabase } from "@/lib/supabase/server";
import { hashIp } from "@/lib/supabase/repo";
import { clientIp } from "@/lib/rateLimit";
import { ANON_LIMITS, METRIC_LABEL, PLANS, isPlanId, metricLimit, type Limits, type Metric, type PlanId } from "@/lib/plans";

export type Actor =
  | { kind: "user"; userId: string; email: string | null; plan: PlanId; limits: Limits; subject: string }
  | { kind: "anon"; ipHash: string; limits: Limits; subject: string };

/** The account's plan (cached per request); creates the accounts row if the sign-up trigger missed it. */
export const getAccountPlan = cache(async (userId: string, email?: string | null): Promise<PlanId> => {
  const sb = getServiceSupabase();
  if (!sb) return "free";
  try {
    const { data } = await sb.from("accounts").select("plan").eq("id", userId).maybeSingle();
    if (data && isPlanId(data.plan)) return data.plan;
    if (!data) await sb.from("accounts").upsert({ id: userId, email: email ?? null }, { onConflict: "id", ignoreDuplicates: true });
  } catch {
    /* default */
  }
  return "free";
});

export function userActor(userId: string, email: string | null, plan: PlanId): Actor {
  return { kind: "user", userId, email, plan, limits: PLANS[plan].limits, subject: `u:${userId}` };
}

/** Resolve the caller from the session cookie, falling back to the anonymous IP hash. */
export async function getActor(headers: Headers): Promise<Actor> {
  const user = await getCurrentUser();
  if (user) return userActor(user.id, user.email, await getAccountPlan(user.id, user.email));
  const ipHash = hashIp(clientIp(headers));
  return { kind: "anon", ipHash, limits: ANON_LIMITS, subject: `ip:${ipHash}` };
}

export type ConsumeResult = { allowed: boolean; used: number; limit: number | null };

/** Atomically count `amount` units of `metric` for today; refuses if it would pass the limit. */
export async function consume(subject: string, metric: Metric, limit: number | null, amount = 1): Promise<ConsumeResult> {
  if (limit !== null && amount > limit) return { allowed: false, used: 0, limit };
  const sb = getServiceSupabase();
  if (!sb) return { allowed: true, used: 0, limit };
  try {
    const { data, error } = await sb.rpc("consume_usage", {
      p_subject: subject,
      p_metric: metric,
      p_limit: limit as number, // null = unlimited (still counted for the usage meter)
      p_amount: amount,
    });
    if (error || !data?.[0]) return { allowed: true, used: 0, limit };
    return { allowed: data[0].allowed, used: data[0].used, limit };
  } catch {
    return { allowed: true, used: 0, limit };
  }
}

export function consumeFor(actor: Actor, metric: Metric, amount = 1) {
  return consume(actor.subject, metric, metricLimit(actor.limits, metric), amount);
}

export async function getUsageToday(subject: string): Promise<Partial<Record<Metric, number>>> {
  const sb = getServiceSupabase();
  if (!sb) return {};
  try {
    const day = new Date().toISOString().slice(0, 10);
    const { data } = await sb.from("usage_counters").select("metric, count").eq("subject", subject).eq("day", day);
    return Object.fromEntries((data ?? []).map((r) => [r.metric, r.count]));
  } catch {
    return {};
  }
}

/** Seconds until the daily counters reset (UTC midnight). */
export function secondsUntilReset(): number {
  const now = new Date();
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(1, Math.ceil((next - now.getTime()) / 1000));
}

export function limitMessage(actor: Actor, metric: Metric, limit: number | null): { message: string; upgradeUrl: string } {
  const what = METRIC_LABEL[metric].toLowerCase();
  if (actor.kind === "anon") {
    if (!limit) return { message: "Create a free account to use this.", upgradeUrl: "/signup" };
    const free = metricLimit(PLANS.free.limits, metric);
    return {
      message: `You've used today's ${limit} free ${what}. Create a free account for ${free ?? "more"} a day.`,
      upgradeUrl: "/signup",
    };
  }
  if (!limit) return { message: `This is a Pro feature. See plans to unlock it.`, upgradeUrl: "/pricing" };
  return {
    message: `You've used today's ${limit} ${what} on ${PLANS[actor.plan].name}. They reset at midnight UTC, or see plans for more.`,
    upgradeUrl: "/pricing",
  };
}

export function limitResponse(actor: Actor, metric: Metric, limit: number | null): Response {
  const { message, upgradeUrl } = limitMessage(actor, metric, limit);
  return Response.json(
    { error: message, code: "limit_reached", metric, limit, upgradeUrl },
    { status: 429, headers: { "Retry-After": String(secondsUntilReset()) } }
  );
}
