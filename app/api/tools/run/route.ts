import { NextRequest } from "next/server";
import { HANDLE_RE, normalizePlatforms, runCoreCheck } from "@/lib/check/core";
import { allowRequest } from "@/lib/rateLimit";
import { consumeFor, getActor, limitMessage } from "@/lib/usage";
import { logHistory } from "@/lib/history";
import { metricLimit } from "@/lib/plans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type Tool = "bulk" | "variants" | "suggestions";
const MAX_GENERATED = 16;
const HANDLE_CONCURRENCY = 2;

/**
 * Bulk check / variant compare / suggestions: checks many handles on the core
 * platforms and streams one NDJSON line per handle as it finishes.
 *   POST { tool, handles: string[], platforms?: string[], base?: string }
 */
export async function POST(request: NextRequest) {
  let body: { tool?: string; handles?: unknown; platforms?: unknown; base?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send a JSON body." }, { status: 400 });
  }
  const tool = body.tool as Tool;
  if (!["bulk", "variants", "suggestions"].includes(tool)) return Response.json({ error: "Unknown tool." }, { status: 400 });

  const actor = await getActor(request.headers);
  if (actor.kind === "anon") {
    return Response.json({ error: "Create a free account to try this tool.", code: "login_required", upgradeUrl: "/signup" }, { status: 401 });
  }
  if (!allowRequest(`tools:${actor.userId}`, 6, 60_000)) {
    return Response.json({ error: "Slow down a little: try again in a minute." }, { status: 429 });
  }

  const raw = Array.isArray(body.handles) ? body.handles.filter((h): h is string => typeof h === "string") : [];
  const handles = [...new Map(raw.map((h) => h.trim().replace(/^@+/, "")).filter((h) => HANDLE_RE.test(h)).map((h) => [h.toLowerCase(), h])).values()];
  if (!handles.length) return Response.json({ error: "Add at least one valid handle." }, { status: 400 });
  const cap = tool === "bulk" ? actor.limits.bulkMaxHandles : MAX_GENERATED;
  if (handles.length > cap) {
    return Response.json(
      {
        error:
          tool === "bulk"
            ? `${actor.plan === "free" ? "Free" : "Your plan"} checks up to ${cap} handles at once. You pasted ${handles.length}.`
            : `Too many candidates (max ${cap}).`,
        code: "limit_reached",
        upgradeUrl: "/pricing",
      },
      { status: 400 }
    );
  }

  const usage = await consumeFor(actor, "tool_run");
  if (!usage.allowed) {
    const { message, upgradeUrl } = limitMessage(actor, "tool_run", metricLimit(actor.limits, "tool_run"));
    return Response.json({ error: message, code: "limit_reached", upgradeUrl }, { status: 429 });
  }

  const platforms = normalizePlatforms(Array.isArray(body.platforms) ? (body.platforms as string[]) : null);
  const started = Date.now();
  const encoder = new TextEncoder();
  const userId = actor.userId;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      const send = (obj: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
        } catch {
          closed = true;
        }
      };
      send({ type: "meta", total: handles.length, platforms, tool });
      let available = 0;
      let next = 0;
      const worker = async () => {
        while (next < handles.length && !request.signal.aborted) {
          const handle = handles[next++];
          try {
            const { results, summary } = await runCoreCheck(handle, { platformIds: platforms });
            if (summary.available === results.length) available++;
            send({
              type: "result",
              handle,
              summary,
              results: results.map((r) => ({
                platformId: r.platformId,
                platformName: r.platformName,
                status: r.status,
                reason: r.reason ?? null,
                userMessage: r.userMessage ?? null,
                profileUrl: r.status === "taken" ? (r.profileUrl ?? null) : null,
                checkUrl: r.checkUrl ?? null,
              })),
            });
          } catch (e) {
            send({ type: "result", handle, error: e instanceof Error ? e.message : "Check failed", results: [] });
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(HANDLE_CONCURRENCY, handles.length) }, worker));
      const durationMs = Date.now() - started;
      send({ type: "done", durationMs });
      void logHistory(userId, typeof body.base === "string" && HANDLE_RE.test(body.base) ? body.base : handles[0], tool, {
        handles: handles.length,
        platforms: platforms.length,
        freeEverywhere: available,
      });
      closed = true;
      try {
        controller.close();
      } catch {
        /* closed */
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" },
  });
}
