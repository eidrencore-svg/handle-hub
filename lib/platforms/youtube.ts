import type { PlatformAdapter, CheckResult } from "./types";
import {
  BROWSER_UA,
  extractMeta,
  extractTitle,
  fetchWithRetry,
  isAbortError,
  looksLikeChallenge,
} from "./http";
import { buildProfile, parseCount, sanitizeBio } from "./profile";

const YT_HANDLE_RE = /^[A-Za-z0-9._-]{3,30}$/;

function profileFromYtHtml(body: string) {
  const ogTitle = extractMeta(body, "og:title");
  const ogImage = extractMeta(body, "og:image");
  const ogDesc = extractMeta(body, "og:description");
  // Page header (pageHeaderViewModel) metadata is the channel's own count;
  // subscriberCountText elsewhere can belong to featured/related channels.
  const subLabel =
    body.match(/"accessibilityLabel":"([\d.,]+\s*(?:thousand|million|billion)?\s*subscribers?)"/i)?.[1] ||
    body.match(/"content":"([\d.,]+[kmb]?\s*subscribers?)"/i)?.[1] ||
    body.match(
      /"subscriberCountText":\{"accessibility":\{"accessibilityData":\{"label":"([^"]+)"/
    )?.[1];
  const videosLabel =
    body.match(/"accessibilityLabel":"([\d.,]+\s*(?:thousand|million)?\s*videos?)"/i)?.[1] ||
    body.match(/"content":"([\d.,]+[kmb]?\s*videos?)"/i)?.[1];
  const avatar =
    body.match(/"avatar":\{"thumbnails":\[\{"url":"([^"]+)"/)?.[1] || ogImage;
  return buildProfile({
    displayName: ogTitle?.replace(/\s*-\s*YouTube\s*$/i, "").trim(),
    avatarUrl: avatar,
    bio: sanitizeBio(ogDesc),
    followers: parseCount(subLabel),
    posts: parseCount(videosLabel),
    extra: subLabel ? { subscribersLabel: subLabel } : undefined,
  });
}

async function checkViaDataApi(
  handle: string,
  apiKey: string
): Promise<CheckResult> {
  const url = new URL("https://www.googleapis.com/youtube/v3/channels");
  url.searchParams.set("part", "snippet,statistics");
  url.searchParams.set("forHandle", `@${handle}`);
  url.searchParams.set("key", apiKey);

  const res = await fetchWithRetry(url.toString());
  if (res.status === 403 || res.status === 400) {
    const body = await res.text();
    return {
      status: "unknown",
      reason: "auth_failed",
      confidence: "low",
      meta: {
        method: "youtube_data_api",
        devNote: `YouTube Data API rejected key/request (HTTP ${res.status})`,
        detail: body.slice(0, 200),
      },
    };
  }
  if (!res.ok) {
    return {
      status: "unknown",
      reason: res.status === 429 ? "rate_limited" : "unexpected_response",
      confidence: "low",
      meta: {
        method: "youtube_data_api",
        devNote: `Unexpected HTTP ${res.status}`,
      },
    };
  }

  const data = (await res.json()) as {
    items?: Array<{
      id?: string;
      snippet?: {
        title?: string;
        description?: string;
        thumbnails?: { high?: { url?: string }; default?: { url?: string } };
      };
      statistics?: {
        subscriberCount?: string;
        videoCount?: string;
        viewCount?: string;
      };
    }>;
  };
  const item = data.items?.[0];
  if (item?.id) {
    const sn = item.snippet;
    const st = item.statistics;
    return {
      status: "taken",
      confidence: "high",
      reason: "ok",
      profileUrl: `https://www.youtube.com/@${encodeURIComponent(handle)}`,
      profile: buildProfile({
        displayName: sn?.title,
        avatarUrl: sn?.thumbnails?.high?.url || sn?.thumbnails?.default?.url,
        bio: sanitizeBio(sn?.description),
        followers: parseCount(st?.subscriberCount),
        posts: parseCount(st?.videoCount),
        extra: st?.viewCount ? { views: Number(st.viewCount) } : undefined,
      }),
      meta: {
        method: "youtube_data_api",
        channelId: item.id,
        title: sn?.title,
      },
    };
  }

  return {
    status: "available",
    confidence: "high",
    reason: "ok",
    meta: {
      method: "youtube_data_api",
      devNote: "No channel for this handle — reserved names may still be blocked.",
    },
  };
}

async function checkViaPublicHandle(handle: string): Promise<CheckResult> {
  const profileUrl = `https://www.youtube.com/@${encodeURIComponent(handle)}`;
  const res = await fetchWithRetry(profileUrl, {
    method: "GET",
    headers: {
      "User-Agent": BROWSER_UA,
      Accept: "text/html",
      "Accept-Language": "en-US,en;q=0.9",
    },
    redirect: "follow",
  });

  const body = await res.text();
  if (looksLikeChallenge(body, res.status)) {
    return {
      status: "unknown",
      reason: "platform_blocked",
      confidence: "low",
      meta: { method: "youtube_handle_page", devNote: "Challenge page detected" },
    };
  }

  const title = extractTitle(body) || "";
  const hasChannel =
    /"channelId":"UC[\w-]+"/.test(body) ||
    /"browseId":"UC[\w-]+"/.test(body) ||
    /canonicalBaseUrl":"\/@/.test(body);
  const unavailable =
    /isChannelUnavailable["']?\s*:\s*true/i.test(body) ||
    /this channel (is )?not available|this page isn.?t available/i.test(body);
  const hard404 =
    res.status === 404 ||
    /404 not found/i.test(title) ||
    /<title>404 Not Found<\/title>/i.test(body);

  if (unavailable) {
    return {
      status: "unknown",
      reason: "unexpected_response",
      confidence: "low",
      meta: {
        method: "youtube_handle_page",
        devNote: "Channel marked unavailable (soft block / terminated).",
      },
    };
  }

  if (hasChannel && !hard404) {
    return {
      status: "taken",
      confidence: "medium",
      reason: "best_effort",
      profileUrl,
      profile: profileFromYtHtml(body),
      meta: { method: "youtube_handle_page", title: title.slice(0, 120) },
    };
  }

  if (hard404) {
    return {
      status: "available",
      confidence: "medium",
      reason: "best_effort",
      meta: {
        method: "youtube_handle_page",
        devNote: "Hard 404 @handle page — reserved names may still be blocked.",
      },
    };
  }

  return {
    status: "unknown",
    reason: "unexpected_response",
    confidence: "low",
    meta: {
      method: "youtube_handle_page",
      devNote: `Ambiguous HTML (HTTP ${res.status})`,
    },
  };
}

export const youtubeAdapter: PlatformAdapter = {
  id: "youtube",
  name: "YouTube",
  kind: "social",
  async checkUsername(username) {
    const handle = username.trim().replace(/^@/, "");
    if (!YT_HANDLE_RE.test(handle)) {
      return {
        status: "invalid",
        reason: "invalid_format",
        confidence: "high",
        meta: {
          method: "validation",
          devNote: "YouTube handles are 3–30 chars: letters, numbers, ., -, _",
        },
      };
    }

    try {
      const apiKey = process.env.YOUTUBE_API_KEY?.trim();
      if (apiKey) return await checkViaDataApi(handle, apiKey);
      return await checkViaPublicHandle(handle);
    } catch (err) {
      return {
        status: "unknown",
        reason: isAbortError(err) ? "timeout" : "network_error",
        confidence: "low",
        meta: {
          method: "youtube_handle_page",
          devNote: isAbortError(err)
            ? "YouTube check timed out"
            : err instanceof Error
              ? err.message
              : "YouTube check failed",
        },
      };
    }
  },
};
