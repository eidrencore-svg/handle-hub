import type { PlatformAdapter, CheckResult } from "./types";
import { fetchWithTimeout, isAbortError } from "./http";

const REDDIT_RE = /^[A-Za-z0-9_-]{3,20}$/;
const REDDIT_UA =
  "linux:handle-hub:v0.1 (username availability check; +https://github.com/eidrencore-svg/handle-hub)";

function looksBlocked(body: string, contentType: string | null): boolean {
  const ct = (contentType || "").toLowerCase();
  if (ct.includes("text/html")) return true;
  if (/whoa there, pardner/i.test(body)) return true;
  if (/<html[\s>]/i.test(body) && !body.trimStart().startsWith("{")) return true;
  return false;
}

async function checkViaAbout(username: string): Promise<CheckResult | null> {
  const res = await fetchWithTimeout(
    `https://www.reddit.com/user/${encodeURIComponent(username)}/about.json`,
    {
      headers: {
        "User-Agent": REDDIT_UA,
        Accept: "application/json",
      },
    }
  );

  const contentType = res.headers.get("content-type");
  const body = await res.text();

  if (looksBlocked(body, contentType)) {
    return {
      status: "unknown",
      meta: {
        method: "user_about",
        note: "Reddit blocked or challenged this request (bot/network policy)",
      },
    };
  }

  if (res.status === 404) {
    return {
      status: "available",
      meta: {
        method: "user_about",
        note: "No Reddit user profile — banned/deleted names may still be reserved.",
      },
    };
  }

  if (res.status === 200) {
    try {
      const json = JSON.parse(body) as {
        data?: { name?: string; is_suspended?: boolean; id?: string };
        kind?: string;
      };
      if (json.data?.name || json.kind === "t2") {
        return {
          status: "taken",
          profileUrl: `https://www.reddit.com/user/${encodeURIComponent(username)}`,
          meta: {
            method: "user_about",
            suspended: Boolean(json.data?.is_suspended),
          },
        };
      }
    } catch {
      return {
        status: "unknown",
        meta: { method: "user_about", note: "Failed to parse Reddit JSON" },
      };
    }
  }

  if (res.status === 429) {
    return {
      status: "unknown",
      meta: { method: "user_about", note: "Reddit rate-limited this check" },
    };
  }

  return null;
}

async function checkViaUsernameAvailable(
  username: string
): Promise<CheckResult> {
  const res = await fetchWithTimeout(
    `https://www.reddit.com/api/username_available.json?user=${encodeURIComponent(username)}`,
    {
      headers: {
        "User-Agent": REDDIT_UA,
        Accept: "application/json",
      },
    }
  );

  const contentType = res.headers.get("content-type");
  const body = await res.text();

  if (looksBlocked(body, contentType)) {
    return {
      status: "unknown",
      meta: {
        method: "username_available",
        note: "Reddit blocked or challenged this request (bot/network policy)",
      },
    };
  }

  if (!res.ok) {
    return {
      status: "unknown",
      meta: {
        method: "username_available",
        note: `Unexpected HTTP ${res.status}`,
      },
    };
  }

  const trimmed = body.trim().toLowerCase();
  if (trimmed === "true") {
    return {
      status: "available",
      meta: { method: "username_available" },
    };
  }
  if (trimmed === "false") {
    return {
      status: "taken",
      profileUrl: `https://www.reddit.com/user/${encodeURIComponent(username)}`,
      meta: { method: "username_available" },
    };
  }

  try {
    const parsed = JSON.parse(body);
    if (parsed === true) {
      return { status: "available", meta: { method: "username_available" } };
    }
    if (parsed === false) {
      return {
        status: "taken",
        profileUrl: `https://www.reddit.com/user/${encodeURIComponent(username)}`,
        meta: { method: "username_available" },
      };
    }
  } catch {
    // fall through
  }

  return {
    status: "unknown",
    meta: {
      method: "username_available",
      note: "Unexpected Reddit username_available payload",
    },
  };
}

export const redditAdapter: PlatformAdapter = {
  id: "reddit",
  name: "Reddit",
  kind: "social",
  async checkUsername(username) {
    if (!REDDIT_RE.test(username)) {
      return {
        status: "invalid",
        meta: {
          note: "Reddit usernames are 3–20 characters: letters, numbers, _ or -",
        },
      };
    }

    try {
      const about = await checkViaAbout(username);
      if (about) {
        if (about.status === "taken" || about.status === "available") {
          return about;
        }
        const available = await checkViaUsernameAvailable(username);
        if (available.status !== "unknown") return available;
        return about;
      }
      return await checkViaUsernameAvailable(username);
    } catch (err) {
      return {
        status: "unknown",
        meta: {
          note: isAbortError(err)
            ? "Reddit check timed out"
            : err instanceof Error
              ? err.message
              : "Reddit check failed",
        },
      };
    }
  },
};
