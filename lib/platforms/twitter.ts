import type { PlatformAdapter, CheckResult } from "./types";
import {
  BROWSER_UA,
  extractMeta,
  extractTitle,
  fetchWithRetry,
  isAbortError,
  looksLikeChallenge,
} from "./http";

const HANDLE_RE = /^[A-Za-z0-9_]{1,15}$/;

async function checkViaApi(
  username: string,
  bearer: string
): Promise<CheckResult> {
  const res = await fetchWithRetry(
    `https://api.x.com/2/users/by/username/${encodeURIComponent(username)}`,
    { headers: { Authorization: `Bearer ${bearer}` } }
  );

  if (res.status === 200) {
    const data = (await res.json()) as {
      data?: { id?: string; username?: string };
    };
    if (data.data?.id) {
      return {
        status: "taken",
        confidence: "high",
        reason: "ok",
        profileUrl: `https://x.com/${encodeURIComponent(username)}`,
        meta: { method: "x_api_v2", userId: data.data.id },
      };
    }
  }

  if (res.status === 404) {
    const body = await res.text();
    if (/could not find user|User not found/i.test(body)) {
      return {
        status: "available",
        confidence: "medium",
        reason: "best_effort",
        meta: {
          method: "x_api_v2",
          devNote:
            "API reports no user — reserved/suspended handles may still be blocked.",
        },
      };
    }
    return {
      status: "unknown",
      reason: "unexpected_response",
      confidence: "low",
      meta: { method: "x_api_v2", devNote: `HTTP 404 body: ${body.slice(0, 120)}` },
    };
  }

  if (res.status === 401 || res.status === 403) {
    return {
      status: "unknown",
      reason: "auth_failed",
      confidence: "low",
      meta: {
        method: "x_api_v2",
        devNote: "X_BEARER_TOKEN rejected or lacks access",
      },
    };
  }

  if (res.status === 429) {
    return {
      status: "unknown",
      reason: "rate_limited",
      confidence: "low",
      meta: { method: "x_api_v2", devNote: "X API rate limited" },
    };
  }

  return {
    status: "unknown",
    reason: "unexpected_response",
    confidence: "low",
    meta: { method: "x_api_v2", devNote: `Unexpected HTTP ${res.status}` },
  };
}

async function checkViaSyndication(username: string): Promise<CheckResult | null> {
  const res = await fetchWithRetry(
    `https://cdn.syndication.twimg.com/widgets/followbutton/info.json?screen_names=${encodeURIComponent(username)}`,
    { headers: { "User-Agent": BROWSER_UA, Accept: "application/json" } }
  );
  if (!res.ok) return null;
  const text = await res.text();
  if (!text || text === "[]") {
    return null;
  }
  try {
    const data = JSON.parse(text) as Array<{
      screen_name?: string;
      id?: string | number;
    }>;
    const hit = data.find(
      (u) =>
        String(u.screen_name || "").toLowerCase() === username.toLowerCase()
    );
    if (hit?.id != null) {
      return {
        status: "taken",
        confidence: "medium",
        reason: "best_effort",
        profileUrl: `https://x.com/${encodeURIComponent(username)}`,
        meta: { method: "x_syndication", userId: String(hit.id) },
      };
    }
  } catch {
    return null;
  }
  return null;
}

async function checkViaPublicProfile(username: string): Promise<CheckResult> {
  const res = await fetchWithRetry(
    `https://x.com/${encodeURIComponent(username)}`,
    {
      method: "GET",
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    }
  );

  const body = await res.text();
  if (looksLikeChallenge(body, res.status)) {
    return {
      status: "unknown",
      reason: "platform_blocked",
      confidence: "low",
      meta: { method: "x_com_profile", devNote: "Challenge/login wall detected" },
    };
  }

  const title = extractTitle(body) || "";
  const ogType = extractMeta(body, "og:type") || "";
  const ogTitle = extractMeta(body, "og:title") || "";
  const profileUser = extractMeta(body, "profile:username") || "";
  const lower = `${title}\n${ogTitle}\n${body.slice(0, 4000)}`.toLowerCase();

  const notFound =
    /user profile not found|could not be found|this account doesn/.test(lower) ||
    /404 error/.test(title.toLowerCase());

  const takenSignals =
    ogType === "profile" ||
    profileUser.toLowerCase() === username.toLowerCase() ||
    new RegExp(`\\(@${username}\\)`, "i").test(title) ||
    /screen_name["']?\s*:\s*["']/i.test(body);

  if (takenSignals && !notFound) {
    return {
      status: "taken",
      confidence: "medium",
      reason: "best_effort",
      profileUrl: `https://x.com/${encodeURIComponent(username)}`,
      meta: { method: "x_com_profile", title },
    };
  }

  if (notFound || (res.status === 404 && /not found/i.test(title))) {
    return {
      status: "available",
      confidence: "medium",
      reason: "best_effort",
      meta: {
        method: "x_com_profile",
        devNote:
          "Profile-not-found page — reserved/suspended handles may still be unavailable.",
      },
    };
  }

  if (/account suspended/i.test(lower)) {
    return {
      status: "taken",
      confidence: "medium",
      reason: "best_effort",
      profileUrl: `https://x.com/${encodeURIComponent(username)}`,
      meta: {
        method: "x_com_profile",
        devNote: "Account appears suspended (name still held).",
      },
    };
  }

  return {
    status: "unknown",
    reason: "unexpected_response",
    confidence: "low",
    meta: {
      method: "x_com_profile",
      devNote: `Ambiguous HTML (HTTP ${res.status}, title=${title.slice(0, 80)})`,
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
        reason: "invalid_format",
        confidence: "high",
        meta: {
          method: "validation",
          devNote: "X handles are 1–15 characters: letters, numbers, underscore",
        },
      };
    }

    try {
      const bearer =
        process.env.X_BEARER_TOKEN?.trim() ||
        process.env.TWITTER_BEARER_TOKEN?.trim();
      if (bearer) return await checkViaApi(username, bearer);

      const synd = await checkViaSyndication(username);
      if (synd) return synd;
      return await checkViaPublicProfile(username);
    } catch (err) {
      return {
        status: "unknown",
        reason: isAbortError(err) ? "timeout" : "network_error",
        confidence: "low",
        meta: {
          method: "x_com_profile",
          devNote: isAbortError(err)
            ? "X check timed out"
            : err instanceof Error
              ? err.message
              : "X check failed",
        },
      };
    }
  },
};
