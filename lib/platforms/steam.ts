import type { PlatformAdapter, CheckResult } from "./types";
import { fetchWithTimeout, isAbortError } from "./http";

const VANITY_RE = /^[a-zA-Z0-9_-]{2,32}$/;

async function checkViaWebApi(
  username: string,
  apiKey: string
): Promise<CheckResult> {
  const url = new URL(
    "https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/"
  );
  url.searchParams.set("key", apiKey);
  url.searchParams.set("vanityurl", username);
  url.searchParams.set("url_type", "1");

  const res = await fetchWithTimeout(url.toString());
  if (!res.ok) {
    return {
      status: "unknown",
      meta: {
        note: `Steam Web API HTTP ${res.status}`,
        method: "ResolveVanityURL",
      },
    };
  }

  const data = (await res.json()) as {
    response?: { success?: number; steamid?: string; message?: string };
  };
  const success = data.response?.success;

  // Steam: success=1 → vanity resolves (taken); success=42 → not found (available)
  if (success === 1 && data.response?.steamid) {
    return {
      status: "taken",
      profileUrl: `https://steamcommunity.com/id/${encodeURIComponent(username)}`,
      meta: {
        method: "ResolveVanityURL",
        steamId: data.response.steamid,
      },
    };
  }
  if (success === 42) {
    return {
      status: "available",
      meta: { method: "ResolveVanityURL" },
    };
  }

  return {
    status: "unknown",
    meta: {
      method: "ResolveVanityURL",
      note: data.response?.message ?? `Unexpected success=${success}`,
    },
  };
}

async function checkViaCommunityXml(username: string): Promise<CheckResult> {
  const res = await fetchWithTimeout(
    `https://steamcommunity.com/id/${encodeURIComponent(username)}/?xml=1`,
    {
      headers: {
        Accept: "application/xml,text/xml,*/*",
      },
    }
  );

  const body = await res.text();
  if (/<steamID64>\d+<\/steamID64>/i.test(body)) {
    return {
      status: "taken",
      profileUrl: `https://steamcommunity.com/id/${encodeURIComponent(username)}`,
      meta: { method: "community_xml" },
    };
  }
  if (
    /could not be found/i.test(body) ||
    /<error>/i.test(body)
  ) {
    return {
      status: "available",
      meta: {
        method: "community_xml",
        note: "No profile for this vanity URL (persona names are separate).",
      },
    };
  }

  return {
    status: "unknown",
    meta: {
      method: "community_xml",
      note: `Unexpected response (HTTP ${res.status})`,
    },
  };
}

export const steamAdapter: PlatformAdapter = {
  id: "steam",
  name: "Steam",
  kind: "gaming",
  async checkUsername(username) {
    if (!VANITY_RE.test(username)) {
      return {
        status: "invalid",
        meta: {
          note: "Steam vanity URLs are 2–32 chars: letters, numbers, _ or -",
        },
      };
    }

    try {
      const apiKey = process.env.STEAM_API_KEY?.trim();
      if (apiKey) {
        return await checkViaWebApi(username, apiKey);
      }
      return await checkViaCommunityXml(username);
    } catch (err) {
      return {
        status: "unknown",
        meta: {
          note: isAbortError(err)
            ? "Steam check timed out"
            : err instanceof Error
              ? err.message
              : "Steam check failed",
        },
      };
    }
  },
};
