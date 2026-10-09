import { NextRequest } from "next/server";
import { HANDLE_RE } from "@/lib/check/core";
import { getActor } from "@/lib/usage";
import { getServiceSupabase } from "@/lib/supabase/server";
import { toCsv } from "@/lib/csv";
import { STATUS_LABEL } from "@/components/statusStyles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOW_MS = 24 * 3600_000;

/** GET /api/tools/export?username=ninja → CSV of the latest result per site from the last 24h (Pro). */
export async function GET(request: NextRequest) {
  const username = request.nextUrl.searchParams.get("username")?.trim() ?? "";
  if (!HANDLE_RE.test(username)) return Response.json({ error: "Enter a valid handle." }, { status: 400 });
  const actor = await getActor(request.headers);
  if (actor.kind === "anon") {
    return Response.json({ error: "Log in to export results.", code: "login_required", upgradeUrl: "/login?next=/tools/export" }, { status: 401 });
  }
  if (!actor.limits.csvExport) {
    return Response.json({ error: "CSV export is part of Pro.", code: "limit_reached", upgradeUrl: "/pricing" }, { status: 403 });
  }
  const sb = getServiceSupabase();
  if (!sb) return Response.json({ error: "Export isn't available right now." }, { status: 503 });

  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const { data, error } = await sb
    .from("latest_checks")
    .select("platform_id, platform_name, category, status, reason, profile_url, checked_at")
    .eq("handle", username)
    .gte("checked_at", since)
    .order("platform_name", { ascending: true })
    .limit(5000);
  if (error) return Response.json({ error: "Export failed. Try again." }, { status: 500 });
  if (!data?.length) {
    return Response.json({ error: `No results for @${username} in the last 24 hours. Run a check first.`, code: "no_results" }, { status: 404 });
  }
  const csv = toCsv(
    ["handle", "platform_id", "platform", "category", "status", "status_label", "reason", "profile_url", "checked_at"],
    data.map((r) => [
      username,
      r.platform_id,
      r.platform_name,
      r.category,
      r.status,
      STATUS_LABEL[String(r.status)] ?? r.status,
      r.reason,
      r.status === "taken" ? r.profile_url : "",
      r.checked_at,
    ])
  );
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="handle-hub-${username}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
