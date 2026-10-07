import { getCurrentUser } from "@/lib/supabase/ssr";
import { getAccountPlan, getUsageToday } from "@/lib/usage";
import { ANON_LIMITS, PLANS, type Limits, type PlanId } from "@/lib/plans";

export type Viewer = { signedIn: boolean; plan: PlanId | null; limits: Limits; toolRunsUsed: number };

/** What the current visitor may do on the tool pages (serializable for client components). */
export async function getViewer(): Promise<Viewer> {
  const user = await getCurrentUser();
  if (!user) return { signedIn: false, plan: null, limits: ANON_LIMITS, toolRunsUsed: 0 };
  const plan = await getAccountPlan(user.id, user.email);
  const usage = await getUsageToday(`u:${user.id}`);
  return { signedIn: true, plan, limits: PLANS[plan].limits, toolRunsUsed: usage.tool_run ?? 0 };
}
