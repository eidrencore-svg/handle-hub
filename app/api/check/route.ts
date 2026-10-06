import { NextRequest, NextResponse } from "next/server";
import { adapters, checkPlatformsSelective, manualCheckUrl, presentResult } from "@/lib/platforms";
import type { ProfileInfo } from "@/lib/platforms/profile";
import { ensureUsername, getLatestChecks, logSearch, persistChecks } from "@/lib/supabase/repo";
import { CACHE_TTL_MS } from "@/lib/supabase/server";
import { allowRequest, clientIp } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Core 10 hand-tuned platforms (fast path). Catalog sites stream from /api/scan.
 *   ?username=…                 required
 *   &platforms=instagram,reddit  optional subset (used by the per-card Retry button)
 *   &fresh=1                     skip the cache
 */
export async function GET(request: NextRequest) {
  const started = Date.now();
  const ip = clientIp(request.headers);
  if (!allowRequest(`check:${ip}`, 30, 60_000)) {
    return NextResponse.json({ error: "Too many checks — try again shortly" }, { status: 429 });
  }

  const username = request.nextUrl.searchParams.get("username")?.trim();
  if (!username) {
    return NextResponse.json({ error: "Query param `username` is required" }, { status: 400 });
  }
  if (!/^[a-zA-Z0-9._-]{1,32}$/.test(username)) {
    return NextResponse.json({ error: "Invalid username format" }, { status: 400 });
  }

  const requested = request.nextUrl.searchParams.get("platforms")?.split(",").map((s) => s.trim()).filter(Boolean);
  const coreIds = adapters.map((a) => a.id).filter((id) => !requested?.length || requested.includes(id));
  const fresh_ = request.nextUrl.searchParams.get("fresh") === "1";
  const [usernameId, cachedAll] = await Promise.all([
    ensureUsername(username),
    fresh_ ? Promise.resolve(new Map()) : getLatestChecks(username, CACHE_TTL_MS, { platformIds: coreIds, withProfiles: true }),
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

  const byId = new Map<string, Record<string, unknown>>();
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
    });
  }
  for (const r of fresh) byId.set(r.platformId, { ...r, cached: false });

  const results = adapters.filter((a) => coreIds.includes(a.id)).map(
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

  const count = (s: string) => results.filter((r) => (r as { status: string }).status === s).length;
  const summary = {
    taken: count("taken"),
    available: count("available"),
    unknown: count("unknown"),
    invalid: count("invalid"),
    cachedPlatforms: cached.size,
    freshPlatforms: fresh.length,
  };
  if (!requested?.length) void logSearch({
    handle: username,
    usernameId,
    summary,
    platformCount: results.length,
    durationMs: Date.now() - started,
    ip,
    source: "check",
  });

  return NextResponse.json({
    username,
    results,
    cache: { hit: cached.size, miss: fresh.length, ttlMinutes: CACHE_TTL_MS / 60000 },
  });
}
