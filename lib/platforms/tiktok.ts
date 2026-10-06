import type { PlatformAdapter, CheckResult } from "./types";
import {
  BROWSER_UA,
  fetchWithRetry,
  isAbortError,
  looksLikeChallenge,
} from "./http";
import { buildProfile, parseCount, sanitizeBio } from "./profile";

const HANDLE_RE = /^[A-Za-z0-9._]{2,24}$/;

function decodeTikTokUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  return raw.replace(/\\u002F/g, "/").replace(/\\\//g, "/");
}

async function enrichFromPage(username: string) {
  try {
    const res = await fetchWithRetry(
      `https://www.tiktok.com/@${encodeURIComponent(username)}`,
      {
        headers: {
          "User-Agent": BROWSER_UA,
          Accept: "text/html",
          "Accept-Language": "en-US,en;q=0.9",
        },
      }
    );
    const html = await res.text();
    const nickname = html.match(/"nickname":"([^"]+)"/)?.[1];
    // Soft-block only when challenge page AND no structured creator JSON
    if (!nickname && looksLikeChallenge(html, res.status)) return undefined;
    const avatar = decodeTikTokUrl(
      html.match(/"avatarLarger":"([^"]+)"/)?.[1] ||
        html.match(/"avatarMedium":"([^"]+)"/)?.[1]
    );
    const signature = html.match(/"signature":"([^"]*)"/)?.[1];
    const followers = parseCount(html.match(/"followerCount":(\d+)/)?.[1]);
    const following = parseCount(html.match(/"followingCount":(\d+)/)?.[1]);
    const posts = parseCount(html.match(/"videoCount":(\d+)/)?.[1]);
    const verified = /"verified":true/.test(html);
    const hearts = parseCount(html.match(/"heartCount":(\d+)/)?.[1]);
    return buildProfile({
      displayName: nickname,
      avatarUrl: avatar,
      bio: sanitizeBio(signature),
      followers,
      following,
      posts,
      verified: verified || undefined,
      extra: hearts != null ? { likes: hearts } : undefined,
    });
  } catch {
    return undefined;
  }
}

export const tiktokAdapter: PlatformAdapter = {
  id: "tiktok",
  name: "TikTok",
  kind: "social",
  async checkUsername(username) {
    if (!HANDLE_RE.test(username)) {
      return {
        status: "invalid",
        reason: "invalid_format",
        confidence: "high",
        meta: {
          method: "validation",
          devNote:
            "TikTok usernames are typically 2–24 chars: letters, numbers, periods, underscores",
        },
      };
    }

    try {
      const profileUrl = `https://www.tiktok.com/@${encodeURIComponent(username)}`;
      const res = await fetchWithRetry(
        `https://www.tiktok.com/oembed?url=${encodeURIComponent(profileUrl)}`,
        {
          headers: {
            "User-Agent": BROWSER_UA,
            Accept: "application/json",
          },
        }
      );

      const body = await res.text();
      // Regional block: TikTok redirects whole networks to /<cc>/about (e.g. India).
      if (
        (res.redirected && !/\/oembed/.test(res.url)) ||
        /Govt\. of India decided to block/i.test(body)
      ) {
        return {
          status: "unknown",
          reason: "platform_blocked",
          confidence: "low",
          meta: {
            method: "tiktok_oembed",
            devNote: `TikTok redirected this server's network to a regional block page (${res.url}).`,
          },
        };
      }
      if (looksLikeChallenge(body, res.status)) {
        return {
          status: "unknown",
          reason: "platform_blocked",
          confidence: "low",
          meta: { method: "tiktok_oembed", devNote: "Challenge detected" },
        };
      }

      if (res.status === 200) {
        try {
          const data = JSON.parse(body) as {
            author_name?: string;
            author_url?: string;
            title?: string;
            thumbnail_url?: string;
          };
          const taken =
            (data.author_url && /tiktok\.com\/@/i.test(data.author_url)) ||
            Boolean(data.author_name || data.title);
          if (taken) {
            const enriched = await enrichFromPage(username);
            const profile =
              enriched ||
              buildProfile({
                displayName: data.author_name,
                avatarUrl: data.thumbnail_url,
              });
            // oEmbed + public page JSON agreeing → two independent signals.
            const corroborated = Boolean(enriched?.displayName);
            return {
              status: "taken",
              confidence: corroborated ? "high" : "medium",
              reason: corroborated ? "ok" : "best_effort",
              profileUrl,
              profile,
              meta: {
                method: "tiktok_oembed",
                authorName: data.author_name,
              },
            };
          }
        } catch {
          return {
            status: "unknown",
            reason: "unexpected_response",
            confidence: "low",
            meta: { method: "tiktok_oembed", devNote: "Invalid JSON on 200" },
          };
        }
      }

      if (res.status === 400 || res.status === 404) {
        try {
          const err = JSON.parse(body) as { message?: string; code?: number };
          if (
            err.message &&
            /something went wrong|not found|no.*exist/i.test(err.message)
          ) {
            return {
              status: "available",
              confidence: "medium",
              reason: "best_effort",
              meta: {
                method: "tiktok_oembed",
                devNote:
                  "oEmbed reports no creator — reserved names may still be blocked.",
              },
            };
          }
        } catch {
          /* fall through */
        }
        return {
          status: "unknown",
          reason: "unexpected_response",
          confidence: "low",
          meta: {
            method: "tiktok_oembed",
            devNote: `HTTP ${res.status} without clear oEmbed error signature`,
          },
        };
      }

      if (res.status === 429) {
        return {
          status: "unknown",
          reason: "rate_limited",
          confidence: "low",
          meta: { method: "tiktok_oembed", devNote: "TikTok rate limited" },
        };
      }

      return {
        status: "unknown",
        reason: "unexpected_response",
        confidence: "low",
        meta: {
          method: "tiktok_oembed",
          devNote: `Unexpected HTTP ${res.status}`,
        },
      };
    } catch (err) {
      return {
        status: "unknown",
        reason: isAbortError(err) ? "timeout" : "network_error",
        confidence: "low",
        meta: {
          method: "tiktok_oembed",
          devNote: isAbortError(err)
            ? "TikTok check timed out"
            : err instanceof Error
              ? err.message
              : "TikTok check failed",
        },
      };
    }
  },
};
