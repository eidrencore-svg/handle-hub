import type { PlatformAdapter, CheckResult } from "./types";
import { BROWSER_UA, fetchWithTimeout, isAbortError } from "./http";

const HANDLE_RE = /^[A-Za-z0-9._]{2,24}$/;

export const tiktokAdapter: PlatformAdapter = {
  id: "tiktok",
  name: "TikTok",
  kind: "social",
  async checkUsername(username) {
    if (!HANDLE_RE.test(username)) {
      return {
        status: "invalid",
        meta: {
          note: "TikTok usernames are typically 2–24 chars: letters, numbers, periods, underscores",
        },
      };
    }

    try {
      const profileUrl = `https://www.tiktok.com/@${encodeURIComponent(username)}`;
      const res = await fetchWithTimeout(
        `https://www.tiktok.com/oembed?url=${encodeURIComponent(profileUrl)}`,
        {
          headers: {
            "User-Agent": BROWSER_UA,
            Accept: "application/json",
          },
        }
      );

      if (res.status === 200) {
        const data = (await res.json()) as {
          author_name?: string;
          author_url?: string;
          title?: string;
        };
        if (data.author_url || data.author_name || data.title) {
          return {
            status: "taken",
            profileUrl,
            meta: {
              method: "tiktok_oembed",
              authorName: data.author_name,
            },
          };
        }
      }

      if (res.status === 400 || res.status === 404) {
        return {
          status: "available",
          meta: {
            method: "tiktok_oembed",
            note: "oEmbed found no creator profile — signup may still block reserved names.",
          },
        };
      }

      return {
        status: "unknown",
        meta: {
          method: "tiktok_oembed",
          note: `Unexpected HTTP ${res.status}`,
        },
      };
    } catch (err) {
      return {
        status: "unknown",
        meta: {
          note: isAbortError(err)
            ? "TikTok check timed out"
            : err instanceof Error
              ? err.message
              : "TikTok check failed",
        },
      };
    }
  },
};
