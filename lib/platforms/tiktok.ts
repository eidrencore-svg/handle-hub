import type { PlatformAdapter, CheckResult } from "./types";
import { BROWSER_UA, SLOW_TIMEOUT_MS, browserHeaders, fetchWithTimeout, looksLikeChallenge } from "./http";
import { runChain, unknown, type Step } from "./chain";
import { buildProfile, parseCount, sanitizeBio } from "./profile";

const HANDLE_RE = /^[A-Za-z0-9._]{2,24}$/;
const profileUrlFor = (u: string) => `https://www.tiktok.com/@${encodeURIComponent(u)}`;

/** TikTok sends whole countries (e.g. India) to /<cc>/about instead of answering. */
function regionBlockedLocation(res: Response): string | null {
  if (res.status < 300 || res.status >= 400) return null;
  const loc = res.headers.get("location") ?? "";
  return /\/[a-z]{2}\/about|\/about\b/i.test(loc) ? loc : null;
}

type PageUser = {
  uniqueId?: string;
  nickname?: string;
  avatarLarger?: string;
  avatarMedium?: string;
  signature?: string;
  verified?: boolean;
};
type PageStats = { followerCount?: number; followingCount?: number; videoCount?: number; heartCount?: number };

function profileFromPage(user: PageUser, stats?: PageStats) {
  return buildProfile({
    displayName: user.nickname,
    avatarUrl: user.avatarLarger || user.avatarMedium,
    bio: sanitizeBio(user.signature),
    followers: stats?.followerCount,
    following: stats?.followingCount,
    posts: stats?.videoCount,
    verified: user.verified || undefined,
    extra: stats?.heartCount != null ? { likes: stats.heartCount } : undefined,
  });
}

/** Public profile page JSON (__UNIVERSAL_DATA_FOR_REHYDRATION__ → webapp.user-detail). */
async function profilePage(username: string, state: { region?: string }): Promise<CheckResult | null> {
  const method = "tiktok_page";
  if (state.region) return null; // same block page again
  const res = await fetchWithTimeout(profileUrlFor(username), {
    headers: browserHeaders(),
    redirect: "manual",
    timeoutMs: SLOW_TIMEOUT_MS,
  });
  const region = regionBlockedLocation(res);
  if (region) {
    state.region = region;
    return unknown(method, "region_blocked", `TikTok redirected this network to ${region}`);
  }
  if (res.status >= 300 && res.status < 400) {
    return unknown(method, "unexpected_response", `redirected to ${res.headers.get("location") ?? "?"}`);
  }
  const html = await res.text();
  if (/Govt\. of India decided to block/i.test(html)) {
    state.region = "india";
    return unknown(method, "region_blocked", "TikTok's India block page");
  }
  const raw = html.match(/<script[^>]+id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/)?.[1];
  if (raw) {
    try {
      const data = JSON.parse(raw) as {
        __DEFAULT_SCOPE__?: Record<string, { statusCode?: number; userInfo?: { user?: PageUser; stats?: PageStats } }>;
      };
      const detail = data.__DEFAULT_SCOPE__?.["webapp.user-detail"];
      const user = detail?.userInfo?.user;
      if (detail?.statusCode === 0 && user?.uniqueId) {
        if (user.uniqueId.toLowerCase() !== username.toLowerCase()) {
          return unknown(method, "unexpected_response", `page returned a different account (${user.uniqueId})`);
        }
        return {
          status: "taken",
          confidence: "high",
          reason: "ok",
          profileUrl: profileUrlFor(username),
          profile: profileFromPage(user, detail.userInfo?.stats),
          meta: { method },
        };
      }
      if (detail?.statusCode === 10221) {
        return {
          status: "available",
          confidence: "medium",
          reason: "best_effort",
          meta: { method, devNote: "TikTok page: statusCode 10221 (no such user) — banned names may still be blocked." },
        };
      }
      if (detail) return unknown(method, "unexpected_response", `user-detail statusCode ${detail.statusCode}`);
    } catch {
      /* fall through */
    }
  }
  if (looksLikeChallenge(html, res.status)) return unknown(method, "platform_blocked", `challenge page (HTTP ${res.status})`);
  return unknown(method, "unexpected_response", `HTTP ${res.status} page without user-detail data`);
}

/** Official oEmbed endpoint: 200 + author_url → taken; 400 → no public creator. */
async function oembed(username: string, state: { region?: string }): Promise<CheckResult | null> {
  const method = "tiktok_oembed";
  if (state.region) return null;
  const res = await fetchWithTimeout(`https://www.tiktok.com/oembed?url=${encodeURIComponent(profileUrlFor(username))}`, {
    headers: { "User-Agent": BROWSER_UA, Accept: "application/json" },
    redirect: "manual",
    timeoutMs: SLOW_TIMEOUT_MS,
  });
  const region = regionBlockedLocation(res);
  if (region) {
    state.region = region;
    return unknown(method, "region_blocked", `TikTok redirected this network to ${region}`);
  }
  const body = await res.text();
  if (res.status === 429) return unknown(method, "rate_limited", "HTTP 429");
  if (res.status === 200) {
    try {
      const data = JSON.parse(body) as { author_name?: string; author_url?: string; thumbnail_url?: string };
      const authorHandle = data.author_url?.match(/tiktok\.com\/@([^/?#]+)/i)?.[1];
      if (authorHandle && authorHandle.toLowerCase() === username.toLowerCase()) {
        return {
          status: "taken",
          confidence: "medium",
          reason: "best_effort",
          profileUrl: profileUrlFor(username),
          profile: buildProfile({ displayName: data.author_name }),
          meta: { method, authorName: data.author_name },
        };
      }
    } catch {
      /* fall through */
    }
    return unknown(method, "unexpected_response", "200 without a matching author_url");
  }
  if (res.status === 400 || res.status === 404) {
    try {
      const err = JSON.parse(body) as { message?: string; code?: number };
      if (err.code === 400 || /something went wrong|not found|no.*exist/i.test(err.message ?? "")) {
        return {
          status: "available",
          confidence: "medium",
          reason: "best_effort",
          meta: { method, devNote: "oEmbed reports no public creator — reserved or banned names may still be blocked." },
        };
      }
    } catch {
      /* fall through */
    }
  }
  if (looksLikeChallenge(body, res.status)) return unknown(method, "platform_blocked", `challenge (HTTP ${res.status})`);
  return unknown(method, "unexpected_response", `HTTP ${res.status}`);
}

/**
 * Third-party public lookup (countik.com, a TikTok analytics site) — used when
 * tiktok.com itself won't answer this network (e.g. TikTok is banned in India).
 * 200 + matching uniqueId → taken; 404 "User Not Found" → no account.
 */
async function countik(username: string): Promise<CheckResult> {
  const method = "countik_lookup";
  const res = await fetchWithTimeout(`https://countik.com/api/exist/${encodeURIComponent(username)}`, {
    headers: { "User-Agent": BROWSER_UA, Accept: "application/json", Referer: "https://countik.com/" },
    timeoutMs: SLOW_TIMEOUT_MS,
  });
  const body = await res.text();
  if (!body.trimStart().startsWith("{")) {
    return unknown(method, looksLikeChallenge(body, res.status) ? "platform_blocked" : "unexpected_response", `HTTP ${res.status} non-JSON`);
  }
  const d = JSON.parse(body) as Record<string, string | undefined>;
  if (res.status === 200 && d.status === "success" && d.uniqueId) {
    if (d.uniqueId.toLowerCase() !== username.toLowerCase()) {
      return unknown(method, "unexpected_response", `lookup returned a different account (${d.uniqueId})`);
    }
    return {
      status: "taken",
      confidence: "medium",
      reason: "best_effort",
      profileUrl: profileUrlFor(username),
      profile: buildProfile({
        displayName: d.nickname,
        avatarUrl: d.avatarThumb,
        bio: sanitizeBio(d.signature),
        followers: parseCount(d.followerCount),
        following: parseCount(d.followingCount),
        posts: parseCount(d.videoCount),
        verified: d.verified === "True" || undefined,
        extra: d.heartCount ? { likes: parseCount(d.heartCount) ?? 0 } : undefined,
      }),
      meta: { method, devNote: "Third-party lookup (countik.com); tiktok.com didn't answer this network." },
    };
  }
  if (res.status === 404 && /user not found/i.test(d.message ?? "")) {
    return {
      status: "available",
      confidence: "medium",
      reason: "best_effort",
      meta: { method, devNote: "Third-party lookup (countik.com) found no TikTok account — banned names may still be blocked." },
    };
  }
  if (res.status === 429) return unknown(method, "rate_limited", "HTTP 429");
  return unknown(method, "unexpected_response", `HTTP ${res.status}`);
}

export const tiktokAdapter: PlatformAdapter = {
  id: "tiktok",
  name: "TikTok",
  kind: "social",
  async checkUsername(username, ctx) {
    if (!HANDLE_RE.test(username)) {
      return {
        status: "invalid",
        reason: "invalid_format",
        confidence: "high",
        meta: { method: "validation", devNote: "TikTok usernames are 2–24 chars: letters, numbers, periods, underscores" },
      };
    }
    const state: { region?: string } = {};
    const steps: Step[] =
      ctx?.pass === 2
        ? [
            { method: "countik_lookup", run: () => countik(username) },
            { method: "tiktok_page", run: () => profilePage(username, state) },
            { method: "tiktok_oembed", run: () => oembed(username, state) },
          ]
        : [
            { method: "tiktok_oembed", run: () => oembed(username, state) },
            { method: "tiktok_page", run: () => profilePage(username, state) },
            { method: "countik_lookup", run: () => countik(username) },
          ];
    const result = await runChain(steps);
    // oEmbed says taken → enrich + corroborate with the page JSON (two independent signals → high).
    if (result.status === "taken" && result.meta?.method === "tiktok_oembed" && !state.region) {
      const page = await profilePage(username, state).catch(() => null);
      if (page?.status === "taken") {
        return { ...page, meta: { ...result.meta, corroboratedBy: "tiktok_page" } };
      }
    }
    if (result.status === "unknown" && state.region) {
      result.reason = "region_blocked";
      result.meta = { ...result.meta, regionBlock: state.region };
    }
    return result;
  },
};
