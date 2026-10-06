import type { PlatformAdapter, CheckResult } from "./types";
import { fetchWithRetry, isAbortError } from "./http";
import { buildProfile, sanitizeBio } from "./profile";

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
  const res = await fetchWithRetry(
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
        devNote:
          "Reddit blocks anonymous JSON from datacenter IPs — set REDDIT_CLIENT_ID/REDDIT_CLIENT_SECRET (official API).",
      },
    };
  }

  if (res.status === 404) {
    return null;
  }

  if (res.status === 200) {
    try {
      const json = JSON.parse(body) as {
        data?: Record<string, unknown> & { name?: string; is_suspended?: boolean; id?: string };
        kind?: string;
      };
      if (json.data?.name || json.kind === "t2") {
        const d = json.data as {
          name?: string;
          is_suspended?: boolean;
          id?: string;
          icon_img?: string;
          snoovatar_img?: string;
          total_karma?: number;
          public_description?: string;
          subreddit?: { public_description?: string; title?: string };
        };
        const avatar = (d.snoovatar_img || d.icon_img || "").split("?")[0] || undefined;
        return {
          status: "taken",
          confidence: "medium",
          reason: "best_effort",
          profileUrl: `https://www.reddit.com/user/${encodeURIComponent(username)}`,
          profile: buildProfile({
            displayName: d.subreddit?.title || d.name,
            avatarUrl: avatar,
            bio: sanitizeBio(d.public_description || d.subreddit?.public_description),
            extra: typeof d.total_karma === "number" ? { karma: d.total_karma } : undefined,
          }),
          meta: {
            method: "user_about",
            suspended: Boolean(d.is_suspended),
          },
        };
      }
    } catch {
      return {
        status: "unknown",
        meta: { method: "user_about", devNote: "Failed to parse Reddit JSON" },
      };
    }
  }

  if (res.status === 429) {
    return {
      status: "unknown",
      meta: { method: "user_about", devNote: "Reddit rate-limited this check" },
    };
  }

  return null;
}

async function checkViaUsernameAvailable(
  username: string
): Promise<CheckResult> {
  const res = await fetchWithRetry(
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
      reason: "platform_blocked",
      confidence: "low",
      meta: {
        method: "username_available",
        devNote: "Reddit blocked or challenged this request (bot/network policy)",
      },
    };
  }

  if (!res.ok) {
    return {
      status: "unknown",
      meta: {
        method: "username_available",
        devNote: `Unexpected HTTP ${res.status}`,
      },
    };
  }

  const trimmed = body.trim().toLowerCase();
  if (trimmed === "true") {
    return {
      status: "available",
      confidence: "high",
      reason: "ok",
      meta: { method: "username_available" },
    };
  }
  if (trimmed === "false") {
    return {
      status: "taken",
      confidence: "high",
      reason: "ok",
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
  }

  return {
    status: "unknown",
    meta: {
      method: "username_available",
      devNote: "Unexpected Reddit username_available payload",
    },
  };
}

let redditToken: { token: string; expiresAt: number } | null = null;

/**
 * Official Reddit API (app-only OAuth, client_credentials). Works from
 * datacenter IPs where www.reddit.com JSON is blocked. Needs a free "script"
 * or "web" app: REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET.
 */
async function checkViaOAuth(username: string, id: string, secret: string): Promise<CheckResult | null> {
  if (!redditToken || Date.now() > redditToken.expiresAt - 60_000) {
    const res = await fetchWithRetry("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": REDDIT_UA,
      },
      body: "grant_type=client_credentials",
      maxRetries: 1,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) return null;
    redditToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
  }
  const res = await fetchWithRetry(`https://oauth.reddit.com/user/${encodeURIComponent(username)}/about`, {
    headers: { Authorization: `Bearer ${redditToken.token}`, "User-Agent": REDDIT_UA, Accept: "application/json" },
    maxRetries: 1,
  });
  if (res.status === 404) {
    return {
      status: "available",
      confidence: "medium",
      reason: "best_effort",
      meta: { method: "reddit_oauth", devNote: "No account found — deleted usernames can never be re-registered on Reddit." },
    };
  }
  if (!res.ok) return null;
  const json = (await res.json()) as { data?: Record<string, unknown> };
  const d = (json.data ?? {}) as {
    name?: string;
    is_suspended?: boolean;
    icon_img?: string;
    snoovatar_img?: string;
    total_karma?: number;
    subreddit?: { public_description?: string; title?: string };
  };
  if (!d.name) return null;
  const avatar = (d.snoovatar_img || d.icon_img || "").split("?")[0] || undefined;
  return {
    status: "taken",
    confidence: "high",
    reason: "ok",
    profileUrl: `https://www.reddit.com/user/${encodeURIComponent(username)}`,
    profile: buildProfile({
      displayName: d.subreddit?.title || d.name,
      avatarUrl: avatar,
      bio: sanitizeBio(d.subreddit?.public_description),
      extra: typeof d.total_karma === "number" ? { karma: d.total_karma } : undefined,
    }),
    meta: { method: "reddit_oauth", suspended: Boolean(d.is_suspended) },
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
        reason: "invalid_format",
        confidence: "high",
        meta: {
          method: "validation",
          devNote: "Reddit usernames are 3–20 characters: letters, numbers, _ or -",
        },
      };
    }

    try {
      const id = process.env.REDDIT_CLIENT_ID?.trim();
      const secret = process.env.REDDIT_CLIENT_SECRET?.trim();
      if (id && secret) {
        const official = await checkViaOAuth(username, id, secret).catch(() => null);
        if (official) return official;
      }
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
          devNote: isAbortError(err)
            ? "Reddit check timed out"
            : err instanceof Error
              ? err.message
              : "Reddit check failed",
        },
      };
    }
  },
};
