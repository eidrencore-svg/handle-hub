import type { PlatformAdapter, CheckResult } from "./types";
import { BROWSER_UA, fetchWithRetry, fetchWithTimeout, isAbortError, looksLikeChallenge } from "./http";
import { buildProfile, parseCount } from "./profile";

// Modern gamertag display names are typically 1–15 chars (letters/numbers/spaces).
const GAMERTAG_RE = /^[a-zA-Z0-9 ]{1,15}$/;

async function checkViaReserve(
  gamertag: string,
  authorization: string,
  reservationId: string
): Promise<CheckResult> {
  const res = await fetchWithTimeout(
    "https://user.mgt.xboxlive.com/gamertags/reserve",
    {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/json",
        "x-xbl-contract-version": "1",
      },
      body: JSON.stringify({
        gamertag,
        reservationId,
      }),
    }
  );

  if (res.status === 200) {
    return {
      status: "available",
      meta: { method: "gamertags_reserve" },
    };
  }
  if (res.status === 409) {
    return {
      status: "taken",
      profileUrl: `https://www.xbox.com/play/user/${encodeURIComponent(gamertag)}`,
      meta: { method: "gamertags_reserve" },
    };
  }
  if (res.status === 400) {
    return {
      status: "invalid",
      meta: {
        method: "gamertags_reserve",
        note: "Xbox rejected this gamertag format",
      },
    };
  }
  if (res.status === 401 || res.status === 403) {
    return {
      status: "unknown",
      meta: {
        method: "gamertags_reserve",
        note: "Xbox authorization expired or invalid",
      },
    };
  }
  if (res.status === 429) {
    return {
      status: "unknown",
      meta: {
        method: "gamertags_reserve",
        note: "Xbox rate limited this check",
      },
    };
  }

  return {
    status: "unknown",
    meta: {
      method: "gamertags_reserve",
      note: `Unexpected HTTP ${res.status}`,
    },
  };
}

async function checkViaOpenXbl(
  gamertag: string,
  apiKey: string
): Promise<CheckResult> {
  const res = await fetchWithTimeout(
    `https://xbl.io/api/v2/search/${encodeURIComponent(gamertag)}`,
    {
      headers: {
        "X-Authorization": apiKey,
        Accept: "application/json",
      },
    }
  );

  if (res.status === 401 || res.status === 403) {
    return {
      status: "unknown",
      meta: {
        method: "openxbl_search",
        note: "OPENXBL_API_KEY rejected",
      },
    };
  }
  if (!res.ok) {
    return {
      status: "unknown",
      meta: {
        method: "openxbl_search",
        note: `OpenXBL HTTP ${res.status}`,
      },
    };
  }

  const data = (await res.json()) as {
    people?: Array<{ gamertag?: string; modernGamertag?: string }>;
  };
  const people = data.people ?? [];
  const needle = gamertag.replace(/\s+/g, "").toLowerCase();
  const match = people.find((p) => {
    const candidates = [p.gamertag, p.modernGamertag]
      .filter(Boolean)
      .map((g) => String(g).replace(/\s+/g, "").toLowerCase());
    return candidates.includes(needle);
  });

  if (match) {
    return {
      status: "taken",
      profileUrl: `https://www.xbox.com/play/user/${encodeURIComponent(gamertag)}`,
      meta: {
        method: "openxbl_search",
        note: "Exact profile match via OpenXBL search (not a reservation check).",
      },
    };
  }

  return {
    status: "available",
    meta: {
      method: "openxbl_search",
      note: "No exact OpenXBL profile match — signup may still reject reserved names.",
    },
  };
}

/**
 * Keyless fallback: xboxgamertag.com, a public Xbox Live gamertag lookup
 * (detection rule from WhatsMyName "Xbox Gamertag"; Sherlock/Maigret list it too).
 * 200 + "Games Played" → taken, 404 + "Gamertag doesn't exist" → available,
 * anything else (503 upstream errors, bot walls) → unknown.
 */
async function checkViaGamertagLookup(gamertag: string): Promise<CheckResult> {
  const res = await fetchWithRetry(
    `https://www.xboxgamertag.com/search/${encodeURIComponent(gamertag)}`,
    {
      headers: { "User-Agent": BROWSER_UA, Accept: "text/html", "Accept-Language": "en-US,en;q=0.9" },
      maxRetries: 1,
    }
  );
  const body = await res.text();
  const base = { meta: { method: "xboxgamertag_lookup" } };
  if (res.status === 200 && body.includes("Games Played") && !looksLikeChallenge(body, res.status)) {
    const pic = body.match(/url=(https:\/\/images-eds-ssl\.xboxlive\.com\/image\?url=[^"&\s]+)/)?.[1];
    const score = body.match(/Gamerscore<\/span>\s*([\d,]+)/)?.[1];
    const games = body.match(/Games Played<\/span>\s*([\d,]+)/)?.[1];
    const name = body.match(/<h1[^>]*>\s*<a[^>]*>([^<]+)<\/a>/)?.[1];
    return {
      status: "taken",
      confidence: "medium",
      reason: "best_effort",
      profileUrl: `https://www.xbox.com/play/user/${encodeURIComponent(gamertag)}`,
      profile: buildProfile({
        displayName: name?.trim(),
        avatarUrl: pic,
        extra: {
          ...(score ? { gamerscore: parseCount(score) ?? 0 } : {}),
          ...(games ? { gamesPlayed: parseCount(games) ?? 0 } : {}),
        },
      }),
      ...base,
    };
  }
  if (res.status === 404 && body.includes("Gamertag doesn't exist")) {
    return {
      status: "available",
      confidence: "medium",
      reason: "best_effort",
      meta: {
        method: "xboxgamertag_lookup",
        devNote: "No Xbox Live profile found via public lookup — Xbox may still reserve some names.",
      },
    };
  }
  return {
    status: "unknown",
    reason: res.status === 429 ? "rate_limited" : "unexpected_response",
    confidence: "low",
    meta: { method: "xboxgamertag_lookup", devNote: `Lookup returned HTTP ${res.status}` },
  };
}

export const xboxAdapter: PlatformAdapter = {
  id: "xbox",
  name: "Xbox",
  kind: "gaming",
  async checkUsername(username) {
    const gamertag = username.trim();
    if (!GAMERTAG_RE.test(gamertag)) {
      return {
        status: "invalid",
        meta: {
          note: "Xbox gamertags are 1–15 characters: letters, numbers, spaces",
        },
      };
    }

    try {
      const authorization = process.env.XBOX_AUTHORIZATION?.trim();
      const reservationId = process.env.XBOX_RESERVATION_ID?.trim();
      if (authorization && reservationId) {
        return await checkViaReserve(gamertag, authorization, reservationId);
      }

      const openXblKey = process.env.OPENXBL_API_KEY?.trim();
      if (openXblKey) {
        return await checkViaOpenXbl(gamertag, openXblKey);
      }

      return await checkViaGamertagLookup(gamertag);
    } catch (err) {
      return {
        status: "unknown",
        meta: {
          note: isAbortError(err)
            ? "Xbox check timed out"
            : err instanceof Error
              ? err.message
              : "Xbox check failed",
        },
      };
    }
  },
};
