import type { PlatformAdapter, CheckResult } from "./types";
import { fetchWithTimeout, isAbortError } from "./http";

const HANDLE_RE = /^[A-Za-z0-9._]{1,30}$/;

const IG_UA =
  "Instagram 192.168.1.2.75 Android (33/13; 420dpi; 1080x2400; Google/google; Pixel 7; panther; panther; en_US; 458229237)";
const IG_APP_ID = "567067343352427";

export const instagramAdapter: PlatformAdapter = {
  id: "instagram",
  name: "Instagram",
  kind: "social",
  async checkUsername(username) {
    if (!HANDLE_RE.test(username) || !/[A-Za-z0-9]/.test(username)) {
      return {
        status: "invalid",
        meta: {
          note: "Instagram usernames are 1–30 chars: letters, numbers, periods, underscores",
        },
      };
    }

    try {
      const res = await fetchWithTimeout(
        `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`,
        {
          headers: {
            "User-Agent": IG_UA,
            "X-IG-App-ID": process.env.INSTAGRAM_APP_ID?.trim() || IG_APP_ID,
            Accept: "*/*",
          },
        }
      );

      if (res.status === 200) {
        const data = (await res.json()) as {
          data?: { user?: { username?: string; id?: string } };
        };
        if (data.data?.user?.username) {
          return {
            status: "taken",
            profileUrl: `https://www.instagram.com/${encodeURIComponent(username)}/`,
            meta: {
              method: "web_profile_info",
              userId: data.data.user.id,
            },
          };
        }
      }

      if (res.status === 404) {
        return {
          status: "available",
          meta: {
            method: "web_profile_info",
            note: "No public profile — Instagram may still reserve some names.",
          },
        };
      }

      if (res.status === 401 || res.status === 429) {
        return {
          status: "unknown",
          meta: {
            method: "web_profile_info",
            note: "Instagram rate-limited or required login for this probe",
          },
        };
      }

      return {
        status: "unknown",
        meta: {
          method: "web_profile_info",
          note: `Unexpected HTTP ${res.status}`,
        },
      };
    } catch (err) {
      return {
        status: "unknown",
        meta: {
          note: isAbortError(err)
            ? "Instagram check timed out"
            : err instanceof Error
              ? err.message
              : "Instagram check failed",
        },
      };
    }
  },
};
