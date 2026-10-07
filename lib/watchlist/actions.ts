"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient, getCurrentUser } from "@/lib/supabase/ssr";
import { getServiceSupabase } from "@/lib/supabase/server";
import { getAccountPlan } from "@/lib/usage";
import { PLANS } from "@/lib/plans";
import { HANDLE_RE, normalizePlatforms, runCoreCheck } from "@/lib/check/core";

export type WatchState = { error?: string; message?: string };

export async function addWatch(_prev: WatchState, formData: FormData): Promise<WatchState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Log in to use the watchlist." };
  const handle = String(formData.get("handle") ?? "").trim().replace(/^@+/, "");
  if (!HANDLE_RE.test(handle)) return { error: "Enter a valid handle." };
  const platforms = normalizePlatforms(formData.getAll("platforms").map(String));
  const sb = getServiceSupabase();
  if (!sb) return { error: "The watchlist isn't available right now." };

  const plan = PLANS[await getAccountPlan(user.id, user.email)];
  if (plan.limits.watchlistSlots === 0) return { error: "The watchlist is part of Pro." };
  const { data: existing } = await sb.from("watchlist").select("handle, platform_id").eq("user_id", user.id);
  const have = new Set((existing ?? []).map((r) => `${r.handle.toLowerCase()}:${r.platform_id}`));
  const toAdd = platforms.filter((p) => !have.has(`${handle.toLowerCase()}:${p}`));
  if (!toAdd.length) return { message: `You're already watching @${handle} there.` };
  if ((existing?.length ?? 0) + toAdd.length > plan.limits.watchlistSlots) {
    return { error: `${plan.name} watches up to ${plan.limits.watchlistSlots} handle × platform pairs. Remove some first.` };
  }

  // First check now, so the list shows a real starting status (never a guessed one).
  const { results } = await runCoreCheck(handle, { platformIds: toAdd });
  const now = new Date().toISOString();
  const { error } = await sb.from("watchlist").insert(
    toAdd.map((platform_id) => {
      const r = results.find((x) => x.platformId === platform_id);
      const known = r && r.status !== "unknown";
      return {
        user_id: user.id,
        handle,
        platform_id,
        last_status: known ? r!.status : null,
        last_checked_at: known ? now : null,
      };
    })
  );
  if (error) return { error: "Couldn't add it. Try again." };
  revalidatePath("/tools/watchlist");
  return { message: `Watching @${handle} on ${toAdd.length} platform${toAdd.length === 1 ? "" : "s"}.` };
}

export async function removeWatch(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const supabase = await createSupabaseServerClient();
  if (!supabase || !/^[0-9a-f-]{36}$/i.test(id)) return;
  await supabase.from("watchlist").delete().eq("id", id); // RLS: own rows only
  revalidatePath("/tools/watchlist");
}
