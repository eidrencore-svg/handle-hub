import type { CheckContext, CheckResult, PlatformAdapter } from "./types";
import { manualCheckUrl, validateHandle } from "./rules";
import { presentResult } from "./messages";
import { steamAdapter } from "./steam";
import { xboxAdapter } from "./xbox";
import { playstationAdapter } from "./playstation";
import { twitterAdapter } from "./twitter";
import { instagramAdapter } from "./instagram";
import { tiktokAdapter } from "./tiktok";
import { discordAdapter } from "./discord";
import { twitchAdapter } from "./twitch";
import { redditAdapter } from "./reddit";
import { youtubeAdapter } from "./youtube";

export type {
  PlatformAdapter,
  PlatformKind,
  UsernameStatus,
  CheckResult,
  Confidence,
  ProfileInfo,
} from "./types";
export type { CheckReason, PresentedResult } from "./messages";
export { formatCount, sanitizeBio } from "./profile";
export { userMessageFor, isEstimate, presentResult } from "./messages";
export { manualCheckUrl, validateHandle } from "./rules";

export const adapters: PlatformAdapter[] = [
  steamAdapter,
  xboxAdapter,
  playstationAdapter,
  twitchAdapter,
  twitterAdapter,
  instagramAdapter,
  tiktokAdapter,
  discordAdapter,
  redditAdapter,
  youtubeAdapter,
];

const PLATFORM_CONCURRENCY = 5;
/** Pause before the automatic second pass on indeterminate platforms. */
const SECOND_PASS_DELAY_MS = 2_000;

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker()
  );
  await Promise.all(workers);
  return results;
}

async function runAdapter(adapter: PlatformAdapter, username: string, ctx: CheckContext): Promise<CheckResult> {
  const why = validateHandle(adapter.id, username);
  if (why) {
    return { status: "invalid", reason: "invalid_format", confidence: "high", meta: { method: "validation", userMessage: why } };
  }
  try {
    return await adapter.checkUsername(username, ctx);
  } catch (err) {
    return { status: "unknown", reason: "network_error", confidence: "low", meta: { devNote: err instanceof Error ? err.message : String(err) } };
  }
}

function present(adapter: PlatformAdapter, username: string, raw: CheckResult, latencyMs: number, pass: 1 | 2) {
  const result = presentResult(raw);
  return {
    platformId: adapter.id,
    platformName: adapter.name,
    kind: adapter.kind,
    latencyMs,
    pass,
    checkUrl: manualCheckUrl(adapter.id, username),
    ...result,
  };
}

/**
 * Check the selected core platforms. Any platform that comes back unknown is
 * retried once after ~2s with a different method order (pass 2) before the
 * result is returned — unless it's rate-limited for minutes (meta.noRetry).
 */
export async function checkPlatformsSelective(
  username: string,
  platformIds: string[],
  opts: { secondPass?: boolean } = {}
) {
  const selected = adapters.filter((a) => platformIds.includes(a.id));
  const first = await mapPool(selected, PLATFORM_CONCURRENCY, async (adapter) => {
    const t0 = Date.now();
    const raw = await runAdapter(adapter, username, { pass: 1 });
    return { adapter, raw, latencyMs: Date.now() - t0 };
  });

  const retry = opts.secondPass === false ? [] : first.filter((r) => r.raw.status === "unknown" && !r.raw.meta?.noRetry);
  const second = new Map<string, { raw: CheckResult; latencyMs: number }>();
  if (retry.length) {
    await new Promise((r) => setTimeout(r, SECOND_PASS_DELAY_MS));
    await mapPool(retry, PLATFORM_CONCURRENCY, async ({ adapter }) => {
      const t0 = Date.now();
      const raw = await runAdapter(adapter, username, { pass: 2 });
      second.set(adapter.id, { raw, latencyMs: Date.now() - t0 });
    });
  }

  return first.map(({ adapter, raw, latencyMs }) => {
    const again = second.get(adapter.id);
    if (again && again.raw.status !== "unknown") {
      return present(adapter, username, { ...again.raw, meta: { ...again.raw.meta, secondPass: true } }, latencyMs + again.latencyMs, 2);
    }
    if (again) {
      return present(adapter, username, { ...again.raw, meta: { ...again.raw.meta, secondPass: true, firstPass: raw.meta?.tried ?? raw.meta?.method } }, latencyMs + again.latencyMs, 2);
    }
    return present(adapter, username, raw, latencyMs, 1);
  });
}

export async function checkAllPlatforms(username: string) {
  const results = await checkPlatformsSelective(username, adapters.map((a) => a.id));
  return { username, results };
}
