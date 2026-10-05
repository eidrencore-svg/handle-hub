import type { PlatformAdapter, CheckResult } from "./types";
import { BROWSER_UA, fetchWithTimeout, isAbortError } from "./http";

const HANDLE_RE = /^[A-Za-z0-9_]{1,15}$/;

async function checkViaApi(
  username: string,
  bearer: string
): Promise<CheckResult> {
  const res = await fetchWithTimeout(
    `https://api.x.com/2/users/by/username/${encodeURIComponent(username)}`,
    {
      headers: {
        Authorization: `Bearer ${bearer}`,
      },
    }
  );

  if (res.status === 200) {
    const data = (await res.json()) as { data?: { id?: string; username?: string } };
    if (data.data?.id) {
      return {
        status: "taken",
        profileUrl: `https://x.com/${encodeURIComponent(username)}`,
        meta: { method: "x_api_v2", userId: data.data.id },
      };
    }
  }

  if (res.status === 404) {
    return {
      status: "available",
      meta: {
        method: "x_api_v2",
        note: "No public user found — reserved/suspended handles may still be blocked at signup.",
      },
    };
  }

  if (res.status === 401 || res.status === 403) {
    return {
      status: "unknown",
      meta: {
        method: "x_api_v2",
        note: "X_BEARER_TOKEN rejected or lacks access",
      },
    };
  }

  if (res.status === 429) {
    return {
      status: "unknown",
      meta: { method: "x_api_v2", note: "X API rate limited" },
    };
  }

  return {
    status: "unknown",
    meta: { method: "x_api_v2", note: `Unexpected HTTP ${res.status}` },
  };
}

async function checkViaPublicProfile(username: string): Promise<CheckResult> {
  const res = await fetchWithTimeout(
    `https://x.com/${encodeURIComponent(username)}`,
    {
      method: "GET",
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/html",
      },
      redirect: "manual",
    }
  );

  const status =
    res.status >= 300 && res.status < 400
      ? (
          await fetchWithTimeout(
            res.headers.get("location") ||
              `https://x.com/${encodeURIComponent(username)}`,
            {
              headers: { "User-Agent": BROWSER_UA, Accept: "text/html" },
              redirect: "follow",
            }
          )
        ).status
      : res.status;

  if (status === 200) {
    return {
      status: "taken",
      profileUrl: `https://x.com/${encodeURIComponent(username)}`,
      meta: {
        method: "x_com_profile",
        note: "Best-effort HTML probe; prefer X_BEARER_TOKEN for accuracy.",
      },
    };
  }
  if (status === 404) {
    return {
      status: "available",
      meta: {
        method: "x_com_profile",
        note: "No public profile page — reserved handles may still be unavailable.",
      },
    };
  }

  return {
    status: "unknown",
    meta: {
      method: "x_com_profile",
      note: `Unexpected HTTP ${status}`,
    },
  };
}

export const twitterAdapter: PlatformAdapter = {
  id: "twitter",
  name: "X (Twitter)",
  kind: "social",
  async checkUsername(username) {
    if (!HANDLE_RE.test(username)) {
      return {
        status: "invalid",
        meta: {
          note: "X handles are 1–15 characters: letters, numbers, underscore",
        },
      };
    }

    try {
      const bearer =
        process.env.X_BEARER_TOKEN?.trim() ||
        process.env.TWITTER_BEARER_TOKEN?.trim();
      if (bearer) {
        return await checkViaApi(username, bearer);
      }
      return await checkViaPublicProfile(username);
    } catch (err) {
      return {
        status: "unknown",
        meta: {
          note: isAbortError(err)
            ? "X check timed out"
            : err instanceof Error
              ? err.message
              : "X check failed",
        },
      };
    }
  },
};
