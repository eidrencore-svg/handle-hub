import type { PlatformAdapter, CheckResult } from "./types";
import { fetchWithTimeout, isAbortError } from "./http";

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

      return {
        status: "unknown",
        reason: "needs_credentials",
        confidence: "low",
        meta: {
          method: "none",
          devNote:
            "Set XBOX_AUTHORIZATION + XBOX_RESERVATION_ID for true availability, or OPENXBL_API_KEY for profile search.",
        },
      };
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
