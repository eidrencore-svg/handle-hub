import { NextRequest } from "next/server";
import { authenticateApiKey, extractApiKey } from "@/lib/apiKeys";
import { HANDLE_RE, normalizePlatforms, runCoreCheck } from "@/lib/check/core";
import { takeToken } from "@/lib/rateLimit";
import { consume, secondsUntilReset } from "@/lib/usage";
import { PLANS } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const err = (status: number, code: string, message: string, headers: Record<string, string> = {}) =>
  Response.json({ error: { code, message } }, { status, headers });

/**
 * Public REST API.
 *   GET /api/v1/check?username=ninja&platforms=twitch,instagram
 *   Authorization: Bearer hh_…
 * One request = one unit of the key owner's daily API quota.
 */
export async function GET(request: NextRequest) {
  const key = extractApiKey(request.headers);
  if (!key) return err(401, "unauthorized", "Send your API key as `Authorization: Bearer hh_…`.");
  const caller = await authenticateApiKey(key);
  if (!caller) return err(401, "unauthorized", "This API key is invalid or has been revoked.");

  const limits = PLANS[caller.plan].limits;
  const minute = takeToken(`api:${caller.userId}`, limits.apiPerMinute, 60_000);
  const minuteHeaders = {
    "X-RateLimit-Minute-Limit": String(limits.apiPerMinute),
    "X-RateLimit-Minute-Remaining": String(minute.remaining),
  };
  if (!minute.allowed) {
    const retry = Math.max(1, Math.ceil((minute.resetAt - Date.now()) / 1000));
    return err(429, "rate_limited", `Too many requests: ${limits.apiPerMinute} per minute on ${PLANS[caller.plan].name}.`, {
      ...minuteHeaders,
      "Retry-After": String(retry),
    });
  }

  const username = request.nextUrl.searchParams.get("username")?.trim() ?? "";
  if (!HANDLE_RE.test(username)) {
    return err(400, "invalid_username", "`username` is required: 1–32 characters, letters, numbers, dot, underscore or hyphen.", minuteHeaders);
  }
  const platforms = normalizePlatforms(request.nextUrl.searchParams.get("platforms"));

  const day = await consume(`u:${caller.userId}`, "api", limits.apiPerDay);
  const reset = String(Math.floor(Date.now() / 1000) + secondsUntilReset());
  const dayHeaders: Record<string, string> = {
    ...minuteHeaders,
    "X-RateLimit-Limit": limits.apiPerDay === null ? "unlimited" : String(limits.apiPerDay),
    "X-RateLimit-Remaining": limits.apiPerDay === null ? "unlimited" : String(Math.max(0, limits.apiPerDay - day.used)),
    "X-RateLimit-Reset": reset,
  };
  if (!day.allowed) {
    return err(
      429,
      "daily_quota_exceeded",
      `Daily API quota reached (${limits.apiPerDay} on ${PLANS[caller.plan].name}). It resets at midnight UTC.`,
      { ...dayHeaders, "Retry-After": String(secondsUntilReset()) }
    );
  }

  const { results, summary } = await runCoreCheck(username, { platformIds: platforms });
  return Response.json(
    {
      username,
      checkedAt: new Date().toISOString(),
      summary: { available: summary.available, taken: summary.taken, unknown: summary.unknown, invalid: summary.invalid },
      results: results.map((r) => ({
        platform: r.platformId,
        name: r.platformName,
        kind: r.kind,
        status: r.status,
        reason: r.reason ?? null,
        message: r.userMessage ?? null,
        confidence: r.confidence ?? null,
        profileUrl: r.status === "taken" ? (r.profileUrl ?? null) : null,
        checkUrl: r.checkUrl ?? null,
        cached: Boolean(r.cached),
      })),
      usage: { plan: caller.plan, usedToday: day.used, dailyLimit: limits.apiPerDay },
    },
    { headers: { ...dayHeaders, "Cache-Control": "no-store" } }
  );
}
