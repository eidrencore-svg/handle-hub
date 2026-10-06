import type { PlatformAdapter, CheckResult } from "./types";
import { BROWSER_UA, fetchWithRetry, isAbortError } from "./http";

// Discord unique usernames: 2–32 chars, lowercase letters, numbers, underscore, period.
const DISCORD_RE = /^[a-z0-9._]{2,32}$/;

/** Discord's signup check shares one rate-limit bucket per network; remember its retry_after. */
let cooldownUntil = 0;

function rateLimited(retryAfterSec: number): CheckResult {
  const mins = Math.max(1, Math.ceil(retryAfterSec / 60));
  return {
    status: "unknown",
    reason: "rate_limited",
    confidence: "low",
    meta: {
      method: "username_attempt_unauthed",
      devNote: `Discord rate-limited this network (retry_after ${Math.round(retryAfterSec)}s)`,
      userMessage: `Discord limits how many names one network can check — try again in about ${mins} min.`,
      retryAfterSec: Math.round(retryAfterSec),
      noRetry: retryAfterSec > 5,
    },
  };
}

export const discordAdapter: PlatformAdapter = {
  id: "discord",
  name: "Discord",
  kind: "social",
  async checkUsername(username) {
    const handle = username.trim().toLowerCase();
    if (!DISCORD_RE.test(handle) || !/[a-z0-9]/.test(handle)) {
      return {
        status: "invalid",
        reason: "invalid_format",
        confidence: "high",
        meta: {
          method: "validation",
          devNote: "Discord usernames are 2–32 chars: lowercase letters, numbers, . or _",
        },
      };
    }

    if (Date.now() < cooldownUntil) return rateLimited((cooldownUntil - Date.now()) / 1000);

    try {
      const res = await fetchWithRetry(
        "https://discord.com/api/v9/unique-username/username-attempt-unauthed",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            "User-Agent": BROWSER_UA,
            Origin: "https://discord.com",
            Referer: "https://discord.com/register",
          },
          body: JSON.stringify({ username: handle }),
          maxRetries: 0,
        }
      );

      if (res.status === 429) {
        const data = (await res.json().catch(() => ({}))) as { retry_after?: number };
        const retryAfter = Number(data.retry_after ?? res.headers.get("retry-after") ?? 60);
        if (retryAfter > 5) cooldownUntil = Date.now() + retryAfter * 1000;
        return rateLimited(retryAfter);
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
          confidence: "high",
          reason: "ok",
          meta: { method: "username_attempt_unauthed" },
        };
      }

      return {
        status: "available",
        confidence: "high",
        reason: "ok",
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
