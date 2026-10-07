/**
 * Re-check stale watchlist entries. A handle counts as "freed" only when a real
 * check returns available after it was last seen taken. Unknown results never
 * overwrite the last known status.
 */
import { getServiceSupabase } from "@/lib/supabase/server";
import { runCoreCheck } from "@/lib/check/core";

export type WatchRunResult = {
  checked: number;
  handles: number;
  freed: { id: string; userId: string; handle: string; platformId: string }[];
  pendingNotifications: number;
};

export async function runWatchlist(opts: { batch?: number; staleMinutes?: number } = {}): Promise<WatchRunResult> {
  const sb = getServiceSupabase();
  if (!sb) throw new Error("Supabase service role is not configured.");
  const batch = Math.min(500, Math.max(1, opts.batch ?? 100));
  const staleBefore = new Date(Date.now() - (opts.staleMinutes ?? 360) * 60_000).toISOString();

  const { data: items, error } = await sb
    .from("watchlist")
    .select("id, user_id, handle, platform_id, last_status")
    .or(`last_checked_at.is.null,last_checked_at.lt.${staleBefore}`)
    .order("last_checked_at", { ascending: true, nullsFirst: true })
    .limit(batch);
  if (error) throw new Error(error.message);

  const byHandle = new Map<string, typeof items>();
  for (const it of items ?? []) {
    const key = it.handle.toLowerCase();
    byHandle.set(key, [...(byHandle.get(key) ?? []), it]);
  }

  const freed: WatchRunResult["freed"] = [];
  let checked = 0;
  for (const group of byHandle.values()) {
    const handle = group[0].handle;
    const platformIds = [...new Set(group.map((g) => g.platform_id))];
    const { results } = await runCoreCheck(handle, { platformIds, fresh: true });
    const now = new Date().toISOString();
    for (const it of group) {
      const r = results.find((x) => x.platformId === it.platform_id);
      checked++;
      if (!r || r.status === "unknown") {
        await sb.from("watchlist").update({ last_checked_at: now }).eq("id", it.id);
        continue;
      }
      const becameFree = r.status === "available" && it.last_status === "taken";
      await sb
        .from("watchlist")
        .update({
          last_status: r.status,
          last_checked_at: now,
          ...(becameFree ? { freed_at: now, notified_at: null } : {}),
        })
        .eq("id", it.id);
      if (becameFree) freed.push({ id: it.id, userId: it.user_id, handle: it.handle, platformId: it.platform_id });
    }
  }

  // TODO(email): send "it's free" emails for rows with freed_at set and notified_at null,
  // then set notified_at. Needs an email provider (e.g. Resend/Postmark API key) — not wired yet.
  const { count } = await sb
    .from("watchlist")
    .select("id", { count: "exact", head: true })
    .not("freed_at", "is", null)
    .is("notified_at", null);

  return { checked, handles: byHandle.size, freed, pendingNotifications: count ?? 0 };
}
