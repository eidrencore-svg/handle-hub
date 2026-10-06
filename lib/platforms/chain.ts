import type { CheckResult } from "./types";
import type { CheckReason } from "./messages";
import { isAbortError } from "./http";

export type Step = { method: string; run: () => Promise<CheckResult | null> };

/** Most useful explanation first when every method came back indeterminate. */
const UNKNOWN_PRIORITY: CheckReason[] = [
  "region_blocked",
  "rate_limited",
  "platform_blocked",
  "needs_credentials",
  "timeout",
  "network_error",
  "unexpected_response",
];

export function unknown(method: string, reason: CheckReason, devNote: string, extra: Record<string, unknown> = {}): CheckResult {
  return { status: "unknown", reason, confidence: "low", meta: { method, devNote, ...extra } };
}

/**
 * Try public methods in order; the first decisive answer (taken / available /
 * invalid) wins. Only if every method is indeterminate is the result unknown.
 * `meta.method` names the method that answered; `meta.tried` lists the chain.
 */
export async function runChain(steps: Step[]): Promise<CheckResult> {
  const tried: Array<{ method: string; outcome: string; note?: string }> = [];
  const unknowns: CheckResult[] = [];
  for (const step of steps) {
    let r: CheckResult | null;
    try {
      r = await step.run();
    } catch (err) {
      r = isAbortError(err)
        ? unknown(step.method, "timeout", "timed out")
        : unknown(step.method, "network_error", err instanceof Error ? err.message : String(err));
    }
    if (!r) {
      tried.push({ method: step.method, outcome: "skipped" });
      continue;
    }
    const note = typeof r.meta?.devNote === "string" ? r.meta.devNote.slice(0, 160) : undefined;
    tried.push({ method: step.method, outcome: r.status === "unknown" ? `unknown:${r.reason ?? "?"}` : r.status, note });
    if (r.status !== "unknown") {
      return { ...r, meta: { method: step.method, ...(r.meta ?? {}), tried } };
    }
    unknowns.push(r);
  }
  const best =
    [...unknowns].sort(
      (a, b) => UNKNOWN_PRIORITY.indexOf(a.reason ?? "unexpected_response") - UNKNOWN_PRIORITY.indexOf(b.reason ?? "unexpected_response")
    )[0] ?? unknown("none", "unexpected_response", "no method available");
  return { ...best, meta: { ...(best.meta ?? {}), tried } };
}
