import type { PlatformAdapter, CheckResult } from "./types";
import {
  BROWSER_UA,
  fetchWithRetry,
  isAbortError,
  looksLikeChallenge,
} from "./http";

const HANDLE_RE = /^[A-Za-z0-9._]{2,24}$/;

export const tiktokAdapter: PlatformAdapter = {
  id: "tiktok",
  name: "TikTok",
  kind: "social",
  async checkUsername(username) {
    if (!HANDLE_RE.test(username)) {
      return {
        status: "invalid",
        reason: "invalid_format",
        confidence: "high",
        meta: {
          method: "validation",
          devNote:
            "TikTok usernames are typically 2–24 chars: letters, numbers, periods, underscores",
        },
      };
    }

    try {
      const profileUrl = `https://www.tiktok.com/@${encodeURIComponent(username)}`;
      const res = await fetchWithRetry(
        `https://www.tiktok.com/oembed?url=${encodeURIComponent(profileUrl)}`,
        {
          headers: {
            "User-Agent": BROWSER_UA,
            Accept: "application/json",
          },
        }
      );

      const body = await res.text();
      if (looksLikeChallenge(body, res.status)) {
        return {
          status: "unknown",
          reason: "platform_blocked",
          confidence: "low",
          meta: { method: "tiktok_oembed", devNote: "Challenge detected" },
        };
      }

      if (res.status === 200) {
        try {
          const data = JSON.parse(body) as {
            author_name?: string;
            author_url?: string;
            title?: string;
            type?: string;
          };
          if (data.author_url && /tiktok\.com\/@/i.test(data.author_url)) {
            return {
              status: "taken",
              confidence: "medium",
              reason: "best_effort",
              profileUrl,
              meta: {
                method: "tiktok_oembed",
                authorName: data.author_name,
              },
            };
          }
          if (data.author_name || data.title) {
            return {
              status: "taken",
              confidence: "medium",
              reason: "best_effort",
              profileUrl,
              meta: {
                method: "tiktok_oembed",
                authorName: data.author_name,
              },
            };
          }
        } catch {
          return {
            status: "unknown",
            reason: "unexpected_response",
            confidence: "low",
            meta: { method: "tiktok_oembed", devNote: "Invalid JSON on 200" },
          };
        }
      }

      if (res.status === 400 || res.status === 404) {
        try {
          const err = JSON.parse(body) as { message?: string; code?: number };
          if (
            err.message &&
            /something went wrong|not found|no.*exist/i.test(err.message)
          ) {
            return {
              status: "available",
              confidence: "medium",
              reason: "best_effort",
              meta: {
                method: "tiktok_oembed",
                devNote:
                  "oEmbed reports no creator — reserved names may still be blocked.",
              },
            };
          }
        } catch {
        }
        return {
          status: "unknown",
          reason: "unexpected_response",
          confidence: "low",
          meta: {
            method: "tiktok_oembed",
            devNote: `HTTP ${res.status} without clear oEmbed error signature`,
          },
        };
      }

      if (res.status === 429) {
        return {
          status: "unknown",
          reason: "rate_limited",
          confidence: "low",
          meta: { method: "tiktok_oembed", devNote: "TikTok rate limited" },
        };
      }

      return {
        status: "unknown",
        reason: "unexpected_response",
        confidence: "low",
        meta: {
          method: "tiktok_oembed",
          devNote: `Unexpected HTTP ${res.status}`,
        },
      };
    } catch (err) {
      return {
        status: "unknown",
        reason: isAbortError(err) ? "timeout" : "network_error",
        confidence: "low",
        meta: {
          method: "tiktok_oembed",
          devNote: isAbortError(err)
            ? "TikTok check timed out"
            : err instanceof Error
              ? err.message
              : "TikTok check failed",
        },
      };
    }
  },
};
