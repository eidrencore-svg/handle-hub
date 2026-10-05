import { getAnonSupabase, getServiceSupabase, CACHE_TTL_MS } from "./server";

export type CachedCheck = {
  platformId: string;
  status: string;
  reason?: string | null;
  profileUrl?: string | null;
  estimate?: boolean | null;
  meta?: Record<string, unknown> | null;
  checkedAt: string;
};

export async function getCachedChecks(
  username: string
): Promise<Map<string, CachedCheck>> {
  const map = new Map<string, CachedCheck>();
  const sb = getServiceSupabase() ?? getAnonSupabase();
  if (!sb) return map;

  const since = new Date(Date.now() - CACHE_TTL_MS).toISOString();
  try {
    const { data, error } = await sb
      .from("checks")
      .select(
        "platform_id, status, reason, profile_url, estimate, meta, checked_at"
      )
      .eq("username", username.toLowerCase())
      .gte("checked_at", since)
      .order("checked_at", { ascending: false });

    if (error || !data) return map;

    for (const row of data) {
      const pid = String(row.platform_id);
      if (map.has(pid)) continue;
      map.set(pid, {
        platformId: pid,
        status: String(row.status),
        reason: row.reason,
        profileUrl: row.profile_url,
        estimate: row.estimate,
        meta: (row.meta as Record<string, unknown>) ?? {},
        checkedAt: String(row.checked_at),
      });
    }
  } catch {
  }
  return map;
}

export async function persistChecks(
  username: string,
  results: Array<{
    platformId: string;
    status: string;
    reason?: string;
    profileUrl?: string;
    estimate?: boolean;
    meta?: Record<string, unknown>;
  }>
): Promise<void> {
  const sb = getServiceSupabase();
  if (!sb || results.length === 0) return;

  const rows = results.map((r) => ({
    username: username.toLowerCase(),
    platform_id: r.platformId,
    status: r.status,
    reason: r.reason ?? null,
    profile_url: r.profileUrl ?? null,
    estimate: Boolean(r.estimate),
    meta: r.meta ?? {},
  }));

  try {
    await sb.from("checks").insert(rows);
  } catch {
  }
}

export async function logSearch(
  username: string,
  summary: Record<string, unknown>
): Promise<void> {
  const sb = getServiceSupabase();
  if (!sb) return;
  try {
    await sb.from("searches").insert({
      username: username.toLowerCase(),
      results_summary: summary,
    });
  } catch {
  }
}

export async function getRecentSearches(limit = 12): Promise<
  Array<{ username: string; createdAt: string; summary: Record<string, unknown> }>
> {
  const sb = getAnonSupabase() ?? getServiceSupabase();
  if (!sb) return [];
  try {
    const { data, error } = await sb
      .from("searches")
      .select("username, created_at, results_summary")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data.map((r) => ({
      username: String(r.username),
      createdAt: String(r.created_at),
      summary: (r.results_summary as Record<string, unknown>) ?? {},
    }));
  } catch {
    return [];
  }
}
