import type { PlatformAdapter } from "./types";
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

const PLATFORM_CONCURRENCY = 4;

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

export async function checkAllPlatforms(username: string) {
  const results = await mapPool(adapters, PLATFORM_CONCURRENCY, async (adapter) => {
    const raw = await adapter.checkUsername(username);
    const result = presentResult(raw);
    return {
      platformId: adapter.id,
      platformName: adapter.name,
      kind: adapter.kind,
      ...result,
    };
  });
  return { username, results };
}

export async function checkPlatformsSelective(
  username: string,
  platformIds: string[]
) {
  const selected = adapters.filter((a) => platformIds.includes(a.id));
  const results = await mapPool(selected, PLATFORM_CONCURRENCY, async (adapter) => {
    const raw = await adapter.checkUsername(username);
    const result = presentResult(raw);
    return {
      platformId: adapter.id,
      platformName: adapter.name,
      kind: adapter.kind,
      ...result,
    };
  });
  return results;
}
