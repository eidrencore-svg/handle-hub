import type { PlatformAdapter, CheckResult } from "./types";
import { BROWSER_UA, fetchWithTimeout, isAbortError } from "./http";

// Discord unique usernames: 2–32 chars, lowercase letters, numbers, underscore, period.
const DISCORD_RE = /^[a-z0-9._]{2,32}$/;

export const discordAdapter: PlatformAdapter = {
  id: "discord",
  name: "Discord",
  kind: "social",
  async checkUsername(username) {
    const handle = username.trim().toLowerCase();
    if (!DISCORD_RE.test(handle) || !/[a-z0-9]/.test(handle)) {
      return {
        status: "invalid",
        meta: {
          note: "Discord usernames are 2–32 chars: lowercase letters, numbers, . or _",
        },
      };
    }

    try {
      const res = await fetchWithTimeout(
        "https://discord.com/api/v9/unique-username/username-attempt-unauthed",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "User-Agent": BROWSER_UA,
          },
          body: JSON.stringify({ username: handle }),
        }
      );

      if (res.status === 429) {
        return {
          status: "unknown",
          meta: {
            method: "username_attempt_unauthed",
            note: "Discord rate-limited this check",
          },
        };
      }

      if (!res.ok) {
        return {
          status: "unknown",
          meta: {
            method: "username_attempt_unauthed",
            note: `Unexpected HTTP ${res.status}`,
          },
        };
      }

      const data = (await res.json()) as { taken?: boolean };
      if (typeof data.taken !== "boolean") {
        return {
          status: "unknown",
          meta: {
            method: "username_attempt_unauthed",
            note: "Discord response missing taken flag",
          },
        };
      }

      if (data.taken) {
        return {
          status: "taken",
          meta: { method: "username_attempt_unauthed" },
        };
      }

      return {
        status: "available",
        meta: { method: "username_attempt_unauthed" },
      };
    } catch (err) {
      return {
        status: "unknown",
        meta: {
          note: isAbortError(err)
            ? "Discord check timed out"
            : err instanceof Error
              ? err.message
              : "Discord check failed",
        },
      };
    }
  },
};
