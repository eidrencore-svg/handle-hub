import type { PlatformAdapter, CheckResult } from "./types";
import { fetchWithRetry, isAbortError, looksLikeChallenge } from "./http";
import { buildProfile, sanitizeBio, xmlTag } from "./profile";

const VANITY_RE = /^[a-zA-Z0-9_-]{2,32}$/;

function profileFromXml(body: string) {
  return buildProfile({
    displayName: sanitizeBio(xmlTag(body, "steamID"), 80),
    avatarUrl: xmlTag(body, "avatarFull") || xmlTag(body, "avatarMedium"),
    bio: sanitizeBio(xmlTag(body, "summary") || xmlTag(body, "headline")),
    extra: {
      ...(xmlTag(body, "realname") ? { realName: sanitizeBio(xmlTag(body, "realname"), 80)! } : {}),
      ...(xmlTag(body, "location") ? { location: sanitizeBio(xmlTag(body, "location"), 80)! } : {}),
    },
  });
}

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

  const res = await fetchWithRetry(url.toString());
  if (!res.ok) {
    return {
      status: "unknown",
      reason: res.status === 429 ? "rate_limited" : "unexpected_response",
      confidence: "low",
      meta: {
        method: "ResolveVanityURL",
        devNote: `Steam Web API HTTP ${res.status}`,
      },
    };
  }

  const data = (await res.json()) as {
    response?: { success?: number; steamid?: string; message?: string };
  };
  const success = data.response?.success;

  if (success === 1 && data.response?.steamid) {
    // Enrich with public community XML (no private data)
    let profile;
    try {
      const xmlRes = await fetchWithRetry(
        `https://steamcommunity.com/id/${encodeURIComponent(username)}/?xml=1`,
        { headers: { Accept: "application/xml,text/xml,*/*" } }
      );
      const xml = await xmlRes.text();
      if (!looksLikeChallenge(xml, xmlRes.status)) profile = profileFromXml(xml);
    } catch {
      /* ignore enrich errors */
    }
    return {
      status: "taken",
      confidence: "high",
      reason: "ok",
      profileUrl: `https://steamcommunity.com/id/${encodeURIComponent(username)}`,
      profile,
      meta: {
        method: "ResolveVanityURL",
        steamId: data.response.steamid,
      },
    };
  }
  if (success === 42) {
    return {
      status: "available",
      confidence: "high",
      reason: "ok",
      meta: { method: "ResolveVanityURL" },
    };
  }

  return {
    status: "unknown",
    reason: "unexpected_response",
    confidence: "low",
    meta: {
      method: "ResolveVanityURL",
      devNote: data.response?.message ?? `Unexpected success=${success}`,
    },
  };
}

async function checkViaCommunityXml(username: string): Promise<CheckResult> {
  const res = await fetchWithRetry(
    `https://steamcommunity.com/id/${encodeURIComponent(username)}/?xml=1`,
    { headers: { Accept: "application/xml,text/xml,*/*" } }
  );

  const body = await res.text();
  if (looksLikeChallenge(body, res.status)) {
    return {
      status: "unknown",
      reason: "platform_blocked",
      confidence: "low",
      meta: { method: "community_xml", devNote: "Challenge detected" },
    };
  }

  const idMatch = body.match(/<steamID64>(\d+)<\/steamID64>/i);
  if (idMatch) {
    return {
      status: "taken",
      confidence: "medium",
      reason: "best_effort",
      profileUrl: `https://steamcommunity.com/id/${encodeURIComponent(username)}`,
      profile: profileFromXml(body),
      meta: { method: "community_xml", steamId: idMatch[1] },
    };
  }

  if (
    /could not be found/i.test(body) ||
    (/<error>/i.test(body) && /not be found|no profile/i.test(body))
  ) {
    return {
      status: "available",
      confidence: "medium",
      reason: "best_effort",
      meta: {
        method: "community_xml",
        devNote:
          "No profile for this vanity URL (persona names are separate).",
      },
    };
  }

  return {
    status: "unknown",
    reason: "unexpected_response",
    confidence: "low",
    meta: {
      method: "community_xml",
      devNote: `Unexpected response (HTTP ${res.status})`,
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
        reason: "invalid_format",
        confidence: "high",
        meta: {
          method: "validation",
          devNote: "Steam vanity URLs are 2–32 chars: letters, numbers, _ or -",
        },
      };
    }

    try {
      const apiKey = process.env.STEAM_API_KEY?.trim();
      if (apiKey) return await checkViaWebApi(username, apiKey);
      return await checkViaCommunityXml(username);
    } catch (err) {
      return {
        status: "unknown",
        reason: isAbortError(err) ? "timeout" : "network_error",
        confidence: "low",
        meta: {
          method: "community_xml",
          devNote: isAbortError(err)
            ? "Steam check timed out"
            : err instanceof Error
              ? err.message
              : "Steam check failed",
        },
      };
    }
  },
};
