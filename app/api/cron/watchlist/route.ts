import { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runWatchlist } from "@/lib/watchlist/run";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(request: NextRequest, secret: string): boolean {
  const header = request.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : request.headers.get("x-cron-secret") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Scheduled watchlist re-check. Call every 15–60 min with
 *   Authorization: Bearer $CRON_SECRET
 * Optional: ?batch=100&staleMinutes=360
 */
async function handle(request: NextRequest) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return Response.json({ error: "CRON_SECRET is not set on the server." }, { status: 503 });
  if (!authorized(request, secret)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const batch = Number(request.nextUrl.searchParams.get("batch")) || undefined;
    const staleMinutes = Number(request.nextUrl.searchParams.get("staleMinutes")) || undefined;
    const result = await runWatchlist({ batch, staleMinutes });
    return Response.json({ ok: true, ...result, emailSending: "not configured" });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Watchlist run failed" }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
