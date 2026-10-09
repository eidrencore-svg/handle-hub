import { NextRequest } from "next/server";
import { allowRequest, clientIp } from "@/lib/rateLimit";
import { consumeFor, getActor, limitResponse } from "@/lib/usage";
import { checkDomains } from "@/lib/tools/domains";
import { logHistory } from "@/lib/history";
import { metricLimit } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/tools/domains?name=ninja → RDAP lookups for .com .net .io .gg .app .dev */
export async function GET(request: NextRequest) {
  const name = request.nextUrl.searchParams.get("name")?.trim().replace(/^@+/, "") ?? "";
  if (!/^[a-zA-Z0-9._-]{1,63}$/.test(name)) return Response.json({ error: "Enter a name to check." }, { status: 400 });
  if (!allowRequest(`domains:${clientIp(request.headers)}`, 15, 60_000)) {
    return Response.json({ error: "Too many lookups. Try again in a minute." }, { status: 429 });
  }
  const actor = await getActor(request.headers);
  const usage = await consumeFor(actor, "domain_check");
  if (!usage.allowed) return limitResponse(actor, "domain_check", metricLimit(actor.limits, "domain_check"));
  const out = await checkDomains(name);
  if (actor.kind === "user") {
    void logHistory(actor.userId, name, "domains", {
      available: out.results.filter((r) => r.status === "available").length,
      taken: out.results.filter((r) => r.status === "taken").length,
    });
  }
  return Response.json({ name, ...out }, { headers: { "Cache-Control": "no-store" } });
}
