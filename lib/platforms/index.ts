import type { PlatformAdapter } from "./types";
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

export type { PlatformAdapter, PlatformKind, UsernameStatus, CheckResult } from "./types";

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

export async function checkAllPlatforms(username: string) {
  const results = await Promise.all(
    adapters.map(async (adapter) => {
      const result = await adapter.checkUsername(username);
      return {
        platformId: adapter.id,
        platformName: adapter.name,
        kind: adapter.kind,
        ...result,
      };
    })
  );
  return { username, results };
}
