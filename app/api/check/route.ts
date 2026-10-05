import { NextRequest, NextResponse } from "next/server";
import {
  adapters,
  checkPlatformsSelective,
  presentResult,
} from "@/lib/platforms";
import {
  getCachedChecks,
  logSearch,
  persistChecks,
} from "@/lib/supabase/cache";
import { allowRequest, clientIp } from "@/lib/rateLimit";

export async function GET(request: NextRequest) {
  const ip = clientIp(request.headers);
  if (!allowRequest(`check:${ip}`, 30, 60_000)) {
    return NextResponse.json(
      { error: "Too many checks — try again shortly" },
      { status: 429 }
    );
  }

  const username = request.nextUrl.searchParams.get("username")?.trim();

  if (!username) {
    return NextResponse.json(
      { error: "Query param `username` is required" },
      { status: 400 }
    );
  }

  // Loose gate — per-platform validation happens in adapters
  if (!/^[a-zA-Z0-9._-]{1,32}$/.test(username)) {
    return NextResponse.json(
      { error: "Invalid username format" },
      { status: 400 }
    );
  }

  const cached = await getCachedChecks(username);
  const missingIds = adapters
    .map((a) => a.id)
    .filter((id) => !cached.has(id));

  const fresh =
    missingIds.length > 0
      ? await checkPlatformsSelective(username, missingIds)
      : [];

  // Persist only freshly probed results
  if (fresh.length > 0) {
    void persistChecks(
      username,
      fresh.map((r) => ({
        platformId: r.platformId,
        status: r.status,
        reason: r.reason,
        profileUrl: r.profileUrl,
        estimate: r.estimate,
        meta: {
          ...(r.meta ?? {}),
          confidence: r.confidence,
          ...(r.profile ? { profile: r.profile } : {}),
        },
      }))
    );
  }

  const byId = new Map<string, (typeof fresh)[number] | Record<string, unknown>>();

  for (const [pid, row] of cached) {
    const cachedProfile = row.meta?.profile as
      | import("@/lib/platforms/profile").ProfileInfo
      | undefined;
    const presented = presentResult({
      status: row.status as "available" | "taken" | "unknown" | "invalid",
      reason: (row.reason as undefined) ?? undefined,
      profileUrl: row.profileUrl ?? undefined,
      profile: cachedProfile,
      meta: {
        ...(row.meta ?? {}),
        cached: true,
        checkedAt: row.checkedAt,
      },
      confidence:
        (row.meta?.confidence as "high" | "medium" | "low" | undefined) ??
        undefined,
    });
    const adapter = adapters.find((a) => a.id === pid);
    byId.set(pid, {
      platformId: pid,
      platformName: adapter?.name ?? pid,
      kind: adapter?.kind ?? "social",
      ...presented,
      cached: true,
    });
  }

  for (const r of fresh) {
    byId.set(r.platformId, { ...r, cached: false });
  }

  const results = adapters.map((a) => {
    const hit = byId.get(a.id);
    if (hit) return hit;
    return {
      platformId: a.id,
      platformName: a.name,
      kind: a.kind,
      status: "unknown",
      reason: "unexpected_response",
      confidence: "low",
      estimate: false,
      userMessage: "Couldn't verify right now — try again shortly.",
      meta: {},
    };
  });

  const summary = {
    taken: results.filter((r) => (r as { status: string }).status === "taken")
      .length,
    available: results.filter(
      (r) => (r as { status: string }).status === "available"
    ).length,
    unknown: results.filter(
      (r) => (r as { status: string }).status === "unknown"
    ).length,
    invalid: results.filter(
      (r) => (r as { status: string }).status === "invalid"
    ).length,
    cachedPlatforms: cached.size,
    freshPlatforms: fresh.length,
  };

  void logSearch(username, summary);

  return NextResponse.json({
    username,
    results,
    cache: { hit: cached.size, miss: fresh.length, ttlMinutes: 10 },
  });
}
