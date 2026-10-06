import { NextRequest } from "next/server";
import { catalogReady, getEnabledSites } from "@/lib/engine/catalog";
import { scanSites, toItem, type ScanItem } from "@/lib/engine/scan";
import { allowRequest, clientIp } from "@/lib/rateLimit";
import { ensureUsername, getLatestChecks, logSearch, persistChecks, type CheckRow } from "@/lib/supabase/repo";
import { SCAN_CACHE_TTL_MS } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Serverless hosts cap functions at ~60s; self-hosted (`next start`, Termux) can take longer on slow networks. */
const SCAN_BUDGET_MS = Number(process.env.SCAN_BUDGET_MS) || (process.env.VERCEL ? 50_000 : 90_000);

/**
 * Server-Sent Events stream of catalog-site results.
 *   event: status  {phase: "preparing", message}   (first run only: catalog download)
 *   event: meta    {username, total, cached, source}
 *   event: result  ScanItem            (one per site)
 *   event: error   {message, retryable}
 *   event: done    {taken, available, unknown, invalid, total, durationMs}
 */
export async function GET(request: NextRequest) {
  const username = request.nextUrl.searchParams.get("username")?.trim() ?? "";
  if (!/^[a-zA-Z0-9._-]{1,32}$/.test(username)) {
    return Response.json({ error: "Invalid username format" }, { status: 400 });
  }
  const ip = clientIp(request.headers);
  if (!allowRequest(`scan:${ip}`, 10, 60_000)) {
    return Response.json({ error: "Too many scans — try again in a minute" }, { status: 429 });
  }

  const started = Date.now();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };
      const finish = () => {
        closed = true;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      // Open the stream immediately (proxies and browsers see bytes right away).
      controller.enqueue(encoder.encode(`: handle-hub scan\nretry: 3000\n\n`));
      const heartbeat = setInterval(() => send("ping", { t: Date.now() }), 15_000);
      const counts = { taken: 0, available: 0, unknown: 0, invalid: 0 };

      let sites: Awaited<ReturnType<typeof getEnabledSites>>["sites"] = [];
      let source: "db" | "file" = "file";
      try {
        if (!catalogReady()) {
          send("status", { phase: "preparing", message: "Downloading the site catalog (first run only)…" });
        }
        ({ sites, source } = await getEnabledSites());
        if (!sites.length) throw new Error("No enabled sites: data/sites/selftest.json is missing or doesn't match the catalog. Run `npm run selftest`.");
      } catch (err) {
        clearInterval(heartbeat);
        send("error", { message: err instanceof Error ? err.message : String(err), retryable: true });
        send("done", { ...counts, total: 0, durationMs: Date.now() - started });
        return finish();
      }

      const usernameId = await ensureUsername(username);
      const cached = await getLatestChecks(username, SCAN_CACHE_TTL_MS);
      const tally = (i: ScanItem) => (counts[i.status] = (counts[i.status] ?? 0) + 1);

      const toProbe = [];
      const cachedItems: ScanItem[] = [];
      for (const def of sites) {
        const c = cached.get(def.site);
        if (c && c.status !== "unknown") {
          cachedItems.push(
            toItem(def, {
              site: def.site,
              defId: def.id,
              status: c.status as ScanItem["status"],
              latencyMs: 0,
              reason: c.reason ?? undefined,
              profileUrl: c.profileUrl ?? undefined,
            }, true)
          );
        } else toProbe.push(def);
      }
      send("meta", { username, total: sites.length, cached: cachedItems.length, source });
      for (const item of cachedItems) {
        tally(item);
        send("result", item);
      }

      const fresh: CheckRow[] = [];
      const flush = async () => {
        const rows = fresh.splice(0, fresh.length);
        if (rows.length) await persistChecks(usernameId, rows);
      };
      try {
        for await (const item of scanSites(username, toProbe, {
          concurrency: 48,
          perHost: 2,
          timeoutMs: 10_000,
          deadline: started + SCAN_BUDGET_MS,
          signal: request.signal,
        })) {
          tally(item);
          send("result", item);
          if (item.reason !== "deadline") {
            fresh.push({
              platformId: item.site,
              status: item.status,
              reason: item.reason,
              confidence: item.status === "unknown" ? "low" : "medium",
              method: `catalog:${item.defId}`,
              profileUrl: item.profileUrl,
              latencyMs: item.latencyMs,
              httpStatus: item.httpStatus,
            });
          }
          if (fresh.length >= 200) void flush();
        }
      } catch (err) {
        send("error", { message: `Scan stopped early: ${err instanceof Error ? err.message : String(err)}`, retryable: true });
      } finally {
        clearInterval(heartbeat);
        await flush().catch(() => undefined);
        const durationMs = Date.now() - started;
        send("done", { ...counts, total: sites.length, durationMs });
        void logSearch({
          handle: username,
          usernameId,
          summary: { ...counts, cachedPlatforms: cachedItems.length },
          platformCount: sites.length,
          durationMs,
          ip,
          source: "scan",
        });
        finish();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
