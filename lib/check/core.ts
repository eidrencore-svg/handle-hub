/**
 * Core 10-platform check with the DB cache, shared by /api/check, the public
 * API, the tools and the watchlist cron. Never returns a fake Available: a
 * platform that wasn't checked comes back as unknown.
 */
import { adapters, checkPlatformsSelective, manualCheckUrl, presentResult } from "@/lib/platforms";
import type { ProfileInfo } from "@/lib/platforms/profile";
import { ensureUsername, getLatestChecks, persistChecks } from "@/lib/supabase/repo";
import { CACHE_TTL_MS } from "@/lib/supabase/server";

export const HANDLE_RE = /^[a-zA-Z0-9._-]{1,32}$/;
export const CORE_IDS = adapters.map((a) => a.id);

export type CoreResult = {
  platformId: string;
  platformName: string;
  kind: string;
  status: "available" | "taken" | "unknown" | "invalid";
  reason?: string;
  confidence?: string;
  userMessage?: string;
  profileUrl?: string;
  checkUrl?: string | null;
  cached?: boolean;
  [key: string]: unknown;
};

export type CoreSummary = {
  taken: number;
  available: number;
  unknown: number;
  invalid: number;
  cachedPlatforms: number;
  freshPlatforms: number;
};

export function normalizePlatforms(raw: string | string[] | null | undefined): string[] {
  const list = (Array.isArray(raw) ? raw : (raw ?? "").split(",")).map((s) => s.trim().toLowerCase()).filter(Boolean);
  const valid = list.filter((id) => CORE_IDS.includes(id));
  return valid.length ? [...new Set(valid)] : CORE_IDS;
}

export async function runCoreCheck(
  username: string,
  opts: { platformIds?: string[]; fresh?: boolean } = {}
): Promise<{ results: CoreResult[]; summary: CoreSummary; usernameId: string | null; cache: { hit: number; miss: number; ttlMinutes: number } }> {
  const coreIds = opts.platformIds?.length ? CORE_IDS.filter((id) => opts.platformIds!.includes(id)) : CORE_IDS;
  const [usernameId, cachedAll] = await Promise.all([
    ensureUsername(username),
    opts.fresh ? Promise.resolve(new Map()) : getLatestChecks(username, CACHE_TTL_MS, { platformIds: coreIds, withProfiles: true }),
  ]);
  // Never serve a cached "unknown": always try again.
  const cached = new Map([...cachedAll].filter(([, row]) => row.status !== "unknown"));
  const missingIds = coreIds.filter((id) => !cached.has(id));
  const fresh = missingIds.length > 0 ? await checkPlatformsSelective(username, missingIds) : [];

  if (fresh.length > 0) {
    void persistChecks(
      usernameId,
      fresh.map((r) => ({
        platformId: r.platformId,
        status: r.status,
        reason: r.reason,
        confidence: r.confidence,
        method: typeof r.meta?.method === "string" ? r.meta.method : null,
        profileUrl: r.profileUrl,
        estimate: r.estimate,
        latencyMs: r.latencyMs,
        meta: { ...(r.meta ?? {}), confidence: r.confidence },
        profile: r.profile,
      }))
    );
  }

  const byId = new Map<string, CoreResult>();
  for (const [pid, row] of cached) {
    const presented = presentResult({
      status: row.status as "available" | "taken" | "unknown" | "invalid",
      reason: (row.reason ?? undefined) as never,
      profileUrl: row.profileUrl ?? undefined,
      profile: row.profile as ProfileInfo | undefined,
      meta: { ...row.meta, cached: true, checkedAt: row.checkedAt },
      confidence: (row.confidence as "high" | "medium" | "low" | null) ?? undefined,
    });
    const adapter = adapters.find((a) => a.id === pid);
    byId.set(pid, {
      platformId: pid,
      platformName: adapter?.name ?? pid,
      kind: adapter?.kind ?? "social",
      checkUrl: manualCheckUrl(pid, username),
      ...presented,
      cached: true,
    } as unknown as CoreResult);
  }
  for (const r of fresh) byId.set(r.platformId, { ...(r as unknown as CoreResult), cached: false });

  const results: CoreResult[] = adapters
    .filter((a) => coreIds.includes(a.id))
    .map(
      (a) =>
        byId.get(a.id) ?? {
          platformId: a.id,
          platformName: a.name,
          kind: a.kind,
          status: "unknown",
          reason: "unexpected_response",
          confidence: "low",
          estimate: false,
          userMessage: "The platform's answer wasn't clear enough to call.",
          checkUrl: manualCheckUrl(a.id, username),
          meta: {},
        }
    );

  const count = (s: string) => results.filter((r) => r.status === s).length;
  return {
    results,
    usernameId,
    summary: {
      taken: count("taken"),
      available: count("available"),
      unknown: count("unknown"),
      invalid: count("invalid"),
      cachedPlatforms: cached.size,
      freshPlatforms: fresh.length,
    },
    cache: { hit: cached.size, miss: fresh.length, ttlMinutes: CACHE_TTL_MS / 60000 },
  };
}
