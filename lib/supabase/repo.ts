/**
 * Data access for the normalized schema:
 *   usernames ─< checks >─ platforms,  usernames ─< profiles >─ platforms,
 *   searches, selftest_runs, views latest_checks / platform_health.
 * Writes use the service role; reads fall back to anon (RLS: public read).
 */
import { createHash } from "node:crypto";
import type { Json } from "./types";
import { getAnonSupabase, getServiceSupabase } from "./server";
import type { ProfileInfo } from "@/lib/platforms/profile";

export type LatestCheck = {
  platformId: string;
  status: string;
  reason: string | null;
  confidence: string | null;
  method: string | null;
  profileUrl: string | null;
  estimate: boolean | null;
  meta: Record<string, unknown>;
  checkedAt: string;
  profile?: ProfileInfo;
};

export type CheckRow = {
  platformId: string;
  status: string;
  reason?: string | null;
  confidence?: string | null;
  method?: string | null;
  profileUrl?: string | null;
  estimate?: boolean;
  latencyMs?: number | null;
  httpStatus?: number | null;
  meta?: Record<string, unknown>;
  profile?: ProfileInfo;
};

const reader = () => getServiceSupabase() ?? getAnonSupabase();

export async function ensureUsername(handle: string): Promise<string | null> {
  const sb = getServiceSupabase();
  if (!sb) return null;
  try {
    const { data, error } = await sb
      .from("usernames")
      .upsert({ handle, last_checked: new Date().toISOString() }, { onConflict: "handle" })
      .select("id")
      .single();
    if (error) return null;
    return data.id;
  } catch {
    return null;
  }
}

/** Latest result per platform for a handle newer than `sinceMs`, optionally filtered. */
export async function getLatestChecks(
  handle: string,
  sinceMs: number,
  opts: { platformIds?: string[]; withProfiles?: boolean } = {}
): Promise<Map<string, LatestCheck>> {
  const map = new Map<string, LatestCheck>();
  const sb = reader();
  if (!sb) return map;
  try {
    const since = new Date(Date.now() - sinceMs).toISOString();
    let q = sb
      .from("latest_checks")
      .select("username_id, platform_id, status, reason, confidence, method, profile_url, estimate, meta, checked_at")
      .eq("handle", handle)
      .gte("checked_at", since);
    if (opts.platformIds?.length && opts.platformIds.length <= 50) q = q.in("platform_id", opts.platformIds);
    const { data, error } = await q.limit(5000);
    if (error || !data) return map;
    const filter = opts.platformIds ? new Set(opts.platformIds) : null;
    let usernameId: string | null = null;
    for (const r of data) {
      if (!r.platform_id || (filter && !filter.has(r.platform_id))) continue;
      usernameId = r.username_id;
      map.set(r.platform_id, {
        platformId: r.platform_id,
        status: String(r.status),
        reason: r.reason,
        confidence: r.confidence,
        method: r.method,
        profileUrl: r.profile_url,
        estimate: r.estimate,
        meta: (r.meta as Record<string, unknown>) ?? {},
        checkedAt: String(r.checked_at),
      });
    }
    if (opts.withProfiles && usernameId && map.size) {
      const { data: profs } = await sb
        .from("profiles")
        .select("platform_id, display_name, avatar_url, bio, followers, following, posts, verified, raw")
        .eq("username_id", usernameId)
        .in("platform_id", [...map.keys()]);
      for (const p of profs ?? []) {
        const row = map.get(p.platform_id);
        if (!row) continue;
        const raw = (p.raw as ProfileInfo | null) ?? {};
        row.profile = {
          ...raw,
          displayName: p.display_name ?? undefined,
          avatarUrl: p.avatar_url ?? undefined,
          bio: p.bio ?? undefined,
          followers: p.followers ?? undefined,
          following: p.following ?? undefined,
          posts: p.posts ?? undefined,
          verified: p.verified ?? undefined,
        };
      }
    }
  } catch {
    /* cache is best-effort */
  }
  return map;
}

export async function persistChecks(usernameId: string | null, rows: CheckRow[]): Promise<void> {
  const sb = getServiceSupabase();
  if (!sb || !usernameId || rows.length === 0) return;
  try {
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      await sb.from("checks").insert(
        chunk.map((r) => ({
          username_id: usernameId,
          platform_id: r.platformId,
          status: r.status,
          reason: r.reason ?? null,
          confidence: r.confidence ?? null,
          method: r.method ?? null,
          profile_url: r.profileUrl ?? null,
          estimate: Boolean(r.estimate),
          latency_ms: r.latencyMs ?? null,
          http_status: r.httpStatus ?? null,
          meta: (r.meta ?? {}) as Json,
        }))
      );
    }
    const withProfile = rows.filter((r) => r.status === "taken" && r.profile);
    if (withProfile.length) {
      await sb.from("profiles").upsert(
        withProfile.map((r) => ({
          username_id: usernameId,
          platform_id: r.platformId,
          display_name: r.profile!.displayName ?? null,
          avatar_url: r.profile!.avatarUrl ?? null,
          bio: r.profile!.bio ?? null,
          followers: r.profile!.followers ?? null,
          following: r.profile!.following ?? null,
          posts: r.profile!.posts ?? null,
          verified: r.profile!.verified ?? null,
          profile_url: r.profileUrl ?? null,
          raw: r.profile as unknown as Json,
          fetched_at: new Date().toISOString(),
        })),
        { onConflict: "username_id,platform_id" }
      );
    }
  } catch {
    /* best-effort */
  }
}

/** Salted, daily-rotating hash — raw IPs are never stored. */
export function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT?.trim() || "handle-hub";
  const day = new Date().toISOString().slice(0, 10);
  return createHash("sha256").update(`${salt}:${day}:${ip}`).digest("hex").slice(0, 32);
}

export async function logSearch(input: {
  handle: string;
  usernameId: string | null;
  summary: Record<string, unknown>;
  platformCount: number;
  durationMs: number;
  ip?: string;
  source: "check" | "scan";
}): Promise<void> {
  const sb = getServiceSupabase();
  if (!sb) return;
  try {
    await sb.from("searches").insert({
      username: input.handle.toLowerCase(),
      username_id: input.usernameId,
      results_summary: input.summary as Json,
      platform_count: input.platformCount,
      duration_ms: input.durationMs,
      ip_hash: input.ip ? hashIp(input.ip) : null,
      source: input.source,
    });
  } catch {
    /* best-effort */
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
      .eq("source", "check")
      .order("created_at", { ascending: false })
      .limit(limit * 3);
    if (error || !data) return [];
    const seen = new Set<string>();
    const out: Array<{ username: string; createdAt: string; summary: Record<string, unknown> }> = [];
    for (const r of data) {
      const u = String(r.username);
      if (seen.has(u)) continue;
      seen.add(u);
      out.push({ username: u, createdAt: String(r.created_at), summary: (r.results_summary as Record<string, unknown>) ?? {} });
      if (out.length >= limit) break;
    }
    return out;
  } catch {
    return [];
  }
}

export type PlatformHealthRow = {
  id: string;
  name: string;
  category: string;
  source: string;
  enabled: boolean;
  nsfw: boolean;
  urlMain: string | null;
  selftestPassed: boolean | null;
  lastSelftestAt: string | null;
  healthScore: number | null;
  checks24h: number;
  unknownRate24h: number | null;
  avgLatencyMs24h: number | null;
  notes: string | null;
};

export async function getPlatformHealth(): Promise<PlatformHealthRow[]> {
  const sb = getAnonSupabase() ?? getServiceSupabase();
  if (!sb) return [];
  const out: PlatformHealthRow[] = [];
  try {
    for (let from = 0; from < 10_000; from += 1000) {
      const { data, error } = await sb
        .from("platform_health")
        .select("*")
        .order("source", { ascending: true })
        .order("name", { ascending: true })
        .range(from, from + 999);
      if (error || !data?.length) break;
      for (const r of data) {
        out.push({
          id: String(r.id),
          name: String(r.name),
          category: String(r.category),
          source: String(r.source),
          enabled: Boolean(r.enabled),
          nsfw: Boolean(r.nsfw),
          urlMain: r.url_main,
          selftestPassed: r.selftest_passed,
          lastSelftestAt: r.last_selftest_at,
          healthScore: r.health_score,
          checks24h: Number(r.checks_24h ?? 0),
          unknownRate24h: r.unknown_rate_24h,
          avgLatencyMs24h: r.avg_latency_ms_24h,
          notes: r.notes,
        });
      }
      if (data.length < 1000) break;
    }
  } catch {
    /* empty */
  }
  return out;
}

/** Enabled catalog sites from the DB (site → definition id), or null if unavailable. */
export async function getEnabledCatalogSites(): Promise<Map<string, { defId: string; signupUrl: string | null }> | null> {
  const sb = reader();
  if (!sb) return null;
  try {
    const map = new Map<string, { defId: string; signupUrl: string | null }>();
    for (let from = 0; from < 10_000; from += 1000) {
      const { data, error } = await sb
        .from("platforms")
        .select("id, definition_id, signup_url")
        .neq("source", "adapter")
        .eq("enabled", true)
        .eq("nsfw", false)
        .range(from, from + 999);
      if (error) return null;
      for (const r of data ?? []) if (r.definition_id) map.set(r.id, { defId: r.definition_id, signupUrl: r.signup_url });
      if (!data || data.length < 1000) break;
    }
    return map;
  } catch {
    return null;
  }
}
