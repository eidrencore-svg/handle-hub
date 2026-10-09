import { NextRequest, NextResponse } from "next/server";
import { CORE_IDS, HANDLE_RE, runCoreCheck } from "@/lib/check/core";
import { logSearch } from "@/lib/supabase/repo";
import { allowRequest, clientIp } from "@/lib/rateLimit";
import { consumeFor, getActor, limitResponse } from "@/lib/usage";
import { metricLimit } from "@/lib/plans";
import { logHistory } from "@/lib/history";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Core 10 hand-tuned platforms (fast path). Catalog sites stream from /api/scan.
 *   ?username=…                 required
 *   &platforms=instagram,reddit  optional subset (used by the per-card Retry button)
 *   &fresh=1                     skip the cache
 * A full check counts against the caller's daily `core_check` quota; per-card
 * retries (with &platforms=) only hit the per-minute limit.
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
  if (!HANDLE_RE.test(username)) {
    return NextResponse.json({ error: "Invalid username format" }, { status: 400 });
  }

  const requested = request.nextUrl.searchParams.get("platforms")?.split(",").map((s) => s.trim()).filter(Boolean);
  const isRetry = Boolean(requested?.length);
  const actor = await getActor(request.headers);
  if (!isRetry) {
    const usage = await consumeFor(actor, "core_check");
    if (!usage.allowed) return limitResponse(actor, "core_check", metricLimit(actor.limits, "core_check"));
  }

  const { results, summary, usernameId, cache } = await runCoreCheck(username, {
    platformIds: isRetry ? CORE_IDS.filter((id) => requested!.includes(id)) : undefined,
    fresh: request.nextUrl.searchParams.get("fresh") === "1",
  });

  if (!isRetry) {
    void logSearch({
      handle: username,
      usernameId,
      summary,
      platformCount: results.length,
      durationMs: Date.now() - started,
      ip,
      source: "check",
    });
    if (actor.kind === "user") void logHistory(actor.userId, username, "check", summary);
  }

  return NextResponse.json({ username, results, cache });
}
