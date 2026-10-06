import { fill, probeSite } from "./detect";
import { createPool, hostOf } from "./pool";
import { signupUrlFor } from "./signup";
import type { ProbeResult, SiteDef } from "./types";

export type ScanItem = ProbeResult & {
  name: string;
  category: string;
  claimUrl?: string;
  urlMain?: string;
  cached?: boolean;
};

export function toItem(def: SiteDef, r: ProbeResult, cached = false): ScanItem {
  return {
    ...r,
    name: def.name,
    category: def.category,
    urlMain: def.urlMain,
    claimUrl: r.status === "available" ? signupUrlFor(def.urlMain || def.urlTemplate) ?? def.urlMain : undefined,
    // taken → the profile; unknown → the page the user can open to check by hand.
    profileUrl: r.status === "taken" || r.status === "unknown" ? r.profileUrl : undefined,
    cached,
  };
}

/**
 * Probe many catalog sites concurrently; yields results as they settle.
 * Sites still pending at the deadline are reported as unknown/"deadline".
 */
export async function* scanSites(
  username: string,
  sites: SiteDef[],
  opts: { concurrency?: number; perHost?: number; timeoutMs?: number; deadline: number; signal?: AbortSignal }
): AsyncGenerator<ScanItem> {
  const schedule = createPool(opts.concurrency ?? 24, opts.perHost ?? 2);
  const queue: ScanItem[] = [];
  let wake: (() => void) | null = null;
  let pending = sites.length;
  const settled = new Set<string>();
  const unchecked = (def: SiteDef): ScanItem =>
    toItem(def, { site: def.site, defId: def.id, status: "unknown", latencyMs: 0, reason: "deadline", profileUrl: fill(def.urlTemplate, username) });

  const push = (item: ScanItem) => {
    if (settled.has(item.site)) return;
    settled.add(item.site);
    pending--;
    queue.push(item);
    wake?.();
  };

  for (const def of sites) {
    void schedule(hostOf(def.probeUrl), async () => {
      if (opts.signal?.aborted || Date.now() > opts.deadline - 500) {
        return push(unchecked(def));
      }
      const remaining = Math.max(1_500, Math.min(opts.timeoutMs ?? 8_000, opts.deadline - Date.now()));
      const r = await probeSite(def, username, { timeoutMs: remaining, retries: 1, deadline: opts.deadline });
      push(toItem(def, r));
    });
  }

  const deadlineTimer = setTimeout(() => {
    for (const def of sites) {
      if (!settled.has(def.site)) {
        push(unchecked(def));
      }
    }
  }, Math.max(0, opts.deadline - Date.now()));

  try {
    while (pending > 0 || queue.length) {
      if (!queue.length) await new Promise<void>((r) => (wake = r));
      wake = null;
      while (queue.length) yield queue.shift()!;
    }
  } finally {
    clearTimeout(deadlineTimer);
  }
}
