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
} from "./types";
export type { CheckReason, PresentedResult } from "./messages";
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

export async function checkAllPlatforms(username: string) {
  const results = await Promise.all(
    adapters.map(async (adapter) => {
      const raw = await adapter.checkUsername(username);
      const result = presentResult(raw);
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
