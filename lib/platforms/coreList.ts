/** Client-safe list of the core platforms (mirrors `adapters` order in ./index.ts). */
export const CORE_PLATFORMS = [
  { id: "steam", name: "Steam", kind: "gaming" },
  { id: "xbox", name: "Xbox", kind: "gaming" },
  { id: "playstation", name: "PlayStation", kind: "gaming" },
  { id: "twitch", name: "Twitch", kind: "gaming" },
  { id: "twitter", name: "X", kind: "social" },
  { id: "instagram", name: "Instagram", kind: "social" },
  { id: "tiktok", name: "TikTok", kind: "social" },
  { id: "discord", name: "Discord", kind: "social" },
  { id: "reddit", name: "Reddit", kind: "social" },
  { id: "youtube", name: "YouTube", kind: "social" },
] as const;

export const CORE_PLATFORM_IDS: string[] = CORE_PLATFORMS.map((p) => p.id);
export const corePlatformName = (id: string) => CORE_PLATFORMS.find((p) => p.id === id)?.name ?? id;
