import type { PlatformAdapter, CheckResult } from "./types";
import { fetchWithRetry, isAbortError } from "./http";

// PSN online IDs: 3–16 chars, start with a letter, letters/numbers/-/_
const PSN_RE = /^[a-zA-Z][a-zA-Z0-9_-]{2,15}$/;

export const playstationAdapter: PlatformAdapter = {
  id: "playstation",
  name: "PlayStation",
  kind: "gaming",
  async checkUsername(username) {
    if (!PSN_RE.test(username)) {
      return {
        status: "invalid",
        reason: "invalid_format",
        confidence: "high",
        meta: {
          method: "validation",
          devNote: "PSN online IDs are 3–16 chars, start with a letter, then letters/numbers/-/_",
        },
      };
    }

    try {
      const res = await fetchWithRetry(
        "https://accounts.api.playstation.com/api/v1/accounts/onlineIds",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            onlineId: username,
            reserveIfAvailable: false,
          }),
        }
      );

      const text = await res.text();
      let json: unknown = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        // non-JSON body (e.g. 406 HTML)
      }

      if (res.status === 201 || res.status === 200) {
        return {
          status: "available",
          confidence: "high",
          reason: "ok",
          meta: { method: "psn_onlineIds", httpStatus: res.status },
        };
      }

      if (res.status === 400 && Array.isArray(json)) {
        const messages = (json as Array<{
          validationErrors?: Array<{ message?: string }>;
        }>)
          .flatMap((row) => row.validationErrors ?? [])
          .map((v) => v.message ?? "")
          .join(" ");

        if (/already exists/i.test(messages)) {
          return {
            status: "taken",
            confidence: "high",
            reason: "ok",
            profileUrl: `https://psnprofiles.com/${encodeURIComponent(username)}`,
            meta: { method: "psn_onlineIds", httpStatus: 400 },
          };
        }

        return {
          status: "invalid",
          meta: {
            method: "psn_onlineIds",
            note: messages || "PSN rejected this online ID",
          },
        };
      }

      if (res.status === 406) {
        return {
          status: "invalid",
          meta: {
            method: "psn_onlineIds",
            note: "PSN rejected this online ID (reserved or unacceptable)",
          },
        };
      }

      return {
        status: "unknown",
        meta: {
          method: "psn_onlineIds",
          note: `Unexpected HTTP ${res.status}`,
        },
      };
    } catch (err) {
      return {
        status: "unknown",
        meta: {
          note: isAbortError(err)
            ? "PlayStation check timed out"
            : err instanceof Error
              ? err.message
              : "PlayStation check failed",
        },
      };
    }
  },
};
