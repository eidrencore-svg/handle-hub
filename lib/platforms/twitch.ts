import type { PlatformAdapter, CheckResult } from "./types";
import { BROWSER_UA, fetchWithRetry, fetchWithTimeout, isAbortError } from "./http";

const TWITCH_RE = /^[a-zA-Z0-9_]{4,25}$/;

/** Public web Client-Id used by twitch.tv (best-effort GQL fallback only). */
const TWITCH_WEB_CLIENT_ID = "kimne78kx3ncx6brgo4mv6wki5h1ko";

let cachedAppToken: { token: string; expiresAt: number } | null = null;

async function getHelixAppToken(
  clientId: string,
  clientSecret: string
): Promise<string | null> {
  if (cachedAppToken && Date.now() < cachedAppToken.expiresAt - 60_000) {
    return cachedAppToken.token;
  }

  const url = new URL("https://id.twitch.tv/oauth2/token");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("client_secret", clientSecret);
  url.searchParams.set("grant_type", "client_credentials");

  const res = await fetchWithTimeout(url.toString(), { method: "POST" });
  if (!res.ok) return null;

  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!data.access_token) return null;

  cachedAppToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
  };
  return data.access_token;
}

async function checkViaHelix(
  login: string,
  clientId: string,
  clientSecret: string
): Promise<CheckResult> {
  const token = await getHelixAppToken(clientId, clientSecret);
  if (!token) {
    return {
      status: "unknown",
      meta: {
        method: "helix_users",
        note: "Failed to obtain Twitch app access token",
      },
    };
  }

  const res = await fetchWithRetry(
    `https://api.twitch.tv/helix/users?login=${encodeURIComponent(login)}`,
    {
      headers: {
        "Client-Id": clientId,
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (res.status === 401 || res.status === 403) {
    cachedAppToken = null;
    return {
      status: "unknown",
      meta: {
        method: "helix_users",
        note: "Twitch Helix rejected credentials",
      },
    };
  }
  if (!res.ok) {
    return {
      status: "unknown",
      meta: { method: "helix_users", note: `Unexpected HTTP ${res.status}` },
    };
  }

  const data = (await res.json()) as {
    data?: Array<{ id?: string; login?: string }>;
  };
  const user = data.data?.[0];
  if (user?.id) {
    return {
      status: "taken",
      profileUrl: `https://www.twitch.tv/${encodeURIComponent(login)}`,
      confidence: "high",
      reason: "ok",
      meta: { method: "helix_users", userId: user.id },
    };
  }

  return {
    status: "available",
    confidence: "high",
    reason: "ok",
    meta: {
      method: "helix_users",
      devNote: "No Helix user for this login — reserved names may still be blocked.",
    },
  };
}

async function checkViaGql(login: string): Promise<CheckResult> {
  const res = await fetchWithRetry("https://gql.twitch.tv/gql", {
    method: "POST",
    headers: {
      "Client-Id": TWITCH_WEB_CLIENT_ID,
      "Content-Type": "application/json",
      "User-Agent": BROWSER_UA,
    },
    body: JSON.stringify({
      query:
        "query($login:String!){user(login:$login){id login displayName}}",
      variables: { login },
    }),
  });

  if (!res.ok) {
    return {
      status: "unknown",
      meta: { method: "twitch_gql", note: `Unexpected HTTP ${res.status}` },
    };
  }

  const data = (await res.json()) as {
    data?: { user?: { id?: string; login?: string } | null };
    errors?: unknown[];
  };

  if (data.errors?.length && !data.data) {
    return {
      status: "unknown",
      meta: {
        method: "twitch_gql",
        note: "Twitch GQL returned errors",
      },
    };
  }

  if (data.data?.user?.id) {
    return {
      status: "taken",
      profileUrl: `https://www.twitch.tv/${encodeURIComponent(login)}`,
      confidence: "medium",
      reason: "best_effort",
      meta: {
        method: "twitch_gql",
        userId: data.data.user.id,
        devNote: "Public GQL probe; prefer TWITCH_CLIENT_ID + TWITCH_CLIENT_SECRET.",
      },
    };
  }

  if (data.data && data.data.user === null) {
    return {
      status: "available",
      confidence: "medium",
      reason: "best_effort",
      meta: {
        method: "twitch_gql",
        devNote: "No Twitch user found via GQL — reserved names may still be blocked.",
      },
    };
  }

  return {
    status: "unknown",
    meta: { method: "twitch_gql", note: "Unexpected GQL response shape" },
  };
}

export const twitchAdapter: PlatformAdapter = {
  id: "twitch",
  name: "Twitch",
  kind: "gaming",
  async checkUsername(username) {
    const login = username.trim().toLowerCase();
    if (!TWITCH_RE.test(login)) {
      return {
        status: "invalid",
        reason: "invalid_format",
        confidence: "high",
        meta: {
          method: "validation",
          devNote: "Twitch usernames are 4–25 characters: letters, numbers, underscore",
        },
      };
    }

    try {
      const clientId = process.env.TWITCH_CLIENT_ID?.trim();
      const clientSecret = process.env.TWITCH_CLIENT_SECRET?.trim();
      if (clientId && clientSecret) {
        return await checkViaHelix(login, clientId, clientSecret);
      }
      return await checkViaGql(login);
    } catch (err) {
      return {
        status: "unknown",
        meta: {
          note: isAbortError(err)
            ? "Twitch check timed out"
            : err instanceof Error
              ? err.message
              : "Twitch check failed",
        },
      };
    }
  },
};
