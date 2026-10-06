import type { PlatformAdapter, CheckResult } from "./types";
import { BROWSER_UA, fetchWithRetry, isAbortError, looksLikeChallenge } from "./http";
import { buildProfile, sanitizeBio } from "./profile";

const HANDLE_RE = /^[A-Za-z0-9._]{1,30}$/;

const IG_UA =
  "Instagram 192.168.1.2.75 Android (33/13; 420dpi; 1080x2400; Google/google; Pixel 7; panther; panther; en_US; 458229237)";
const IG_APP_ID = "567067343352427";
const IG_WEB_APP_ID = "936619743392459";

export const instagramAdapter: PlatformAdapter = {
  id: "instagram",
  name: "Instagram",
  kind: "social",
  async checkUsername(username) {
    if (!HANDLE_RE.test(username) || !/[A-Za-z0-9]/.test(username)) {
      return {
        status: "invalid",
        reason: "invalid_format",
        confidence: "high",
        meta: {
          method: "validation",
          devNote:
            "Instagram usernames are 1–30 chars: letters, numbers, periods, underscores",
        },
      };
    }

    try {
      // 1) Public web endpoint with the web app id + referer (rule from Maigret);
      // 2) mobile host as fallback. Both return 401 "require_login" from many
      //    datacenter IPs — that is reported as unknown, never as available.
      let res = await fetchWithRetry(
        `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
        {
          headers: {
            "User-Agent": BROWSER_UA,
            "X-IG-App-ID": IG_WEB_APP_ID,
            Referer: "https://www.instagram.com/",
            Accept: "*/*",
          },
          maxRetries: 0,
        }
      );
      if (res.status === 401 || res.status === 429 || res.status === 403) {
        res = await fetchWithRetry(
          `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
          {
            headers: {
              "User-Agent": IG_UA,
              "X-IG-App-ID": process.env.INSTAGRAM_APP_ID?.trim() || IG_APP_ID,
              Accept: "*/*",
            },
            maxRetries: 0,
          }
        );
      }

      const body = await res.text();
      if (looksLikeChallenge(body, res.status)) {
        return {
          status: "unknown",
          reason: "platform_blocked",
          confidence: "low",
          meta: { method: "web_profile_info", devNote: "Challenge/login wall" },
        };
      }

      if (res.status === 200) {
        try {
          const data = JSON.parse(body) as {
            data?: { user?: { username?: string; id?: string } };
          };
          const user = data.data?.user as
            | {
                id?: string;
                username?: string;
                full_name?: string;
                biography?: string;
                profile_pic_url?: string;
                profile_pic_url_hd?: string;
                is_verified?: boolean;
                edge_followed_by?: { count?: number };
                edge_follow?: { count?: number };
                edge_owner_to_timeline_media?: { count?: number };
              }
            | undefined;
          if (user?.id || user?.username) {
            return {
              status: "taken",
              confidence: "medium",
              reason: "best_effort",
              profileUrl: `https://www.instagram.com/${encodeURIComponent(username)}/`,
              profile: buildProfile({
                displayName: user.full_name || user.username,
                avatarUrl: user.profile_pic_url_hd || user.profile_pic_url,
                bio: sanitizeBio(user.biography),
                followers: user.edge_followed_by?.count,
                following: user.edge_follow?.count,
                posts: user.edge_owner_to_timeline_media?.count,
                verified: user.is_verified,
              }),
              meta: {
                method: "web_profile_info",
                userId: user.id,
              },
            };
          }
        } catch {
          return {
            status: "unknown",
            reason: "unexpected_response",
            confidence: "low",
            meta: { method: "web_profile_info", devNote: "Invalid JSON on 200" },
          };
        }
      }

      if (res.status === 404) {
        try {
          const data = JSON.parse(body) as { message?: string; status?: string };
          if (
            /user not found|not found/i.test(String(data.message || "")) ||
            data.status === "fail"
          ) {
            return {
              status: "available",
              confidence: "medium",
              reason: "best_effort",
              meta: {
                method: "web_profile_info",
                devNote:
                  "API reports no user — Instagram may still reserve some names.",
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
            method: "web_profile_info",
            devNote: "HTTP 404 without clear user-not-found JSON",
          },
        };
      }

      if (res.status === 401 || res.status === 429) {
        return {
          status: "unknown",
          reason: "rate_limited",
          confidence: "low",
          meta: {
            method: "web_profile_info",
            devNote:
              "Instagram requires login for anonymous lookups from this network (datacenter IP). Run checks from a residential network you control, or use the official Instagram Graph API (business accounts only).",
          },
        };
      }

      return {
        status: "unknown",
        reason: "unexpected_response",
        confidence: "low",
        meta: {
          method: "web_profile_info",
          devNote: `Unexpected HTTP ${res.status}`,
        },
      };
    } catch (err) {
      return {
        status: "unknown",
        reason: isAbortError(err) ? "timeout" : "network_error",
        confidence: "low",
        meta: {
          method: "web_profile_info",
          devNote: isAbortError(err)
            ? "Instagram check timed out"
            : err instanceof Error
              ? err.message
              : "Instagram check failed",
        },
      };
    }
  },
};
