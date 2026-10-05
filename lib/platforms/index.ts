import type { PlatformAdapter } from "./types";

/** Placeholder adapters — swap for real platform APIs / probes next. */
export const adapters: PlatformAdapter[] = [
  {
    id: "steam",
    name: "Steam",
    kind: "gaming",
    async checkUsername(username) {
      return { status: "unknown", meta: { note: "adapter stub", username } };
    },
  },
  {
    id: "xbox",
    name: "Xbox",
    kind: "gaming",
    async checkUsername(username) {
      return { status: "unknown", meta: { note: "adapter stub", username } };
    },
  },
  {
    id: "playstation",
    name: "PlayStation",
    kind: "gaming",
    async checkUsername(username) {
      return { status: "unknown", meta: { note: "adapter stub", username } };
    },
  },
  {
    id: "twitter",
    name: "X (Twitter)",
    kind: "social",
    async checkUsername(username) {
      return { status: "unknown", meta: { note: "adapter stub", username } };
    },
  },
  {
    id: "instagram",
    name: "Instagram",
    kind: "social",
    async checkUsername(username) {
      return { status: "unknown", meta: { note: "adapter stub", username } };
    },
  },
  {
    id: "tiktok",
    name: "TikTok",
    kind: "social",
    async checkUsername(username) {
      return { status: "unknown", meta: { note: "adapter stub", username } };
    },
  },
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
