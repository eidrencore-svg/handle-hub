import type { PlatformAdapter, CheckResult } from "./types";
import { BROWSER_UA, fetchWithTimeout, isAbortError } from "./http";

const YT_HANDLE_RE = /^[A-Za-z0-9._-]{3,30}$/;

async function checkViaDataApi(
  handle: string,
  apiKey: string
): Promise<CheckResult> {
  const url = new URL("https://www.googleapis.com/youtube/v3/channels");
  url.searchParams.set("part", "snippet");
  url.searchParams.set("forHandle", `@${handle}`);
  url.searchParams.set("key", apiKey);

  const res = await fetchWithTimeout(url.toString());
  if (res.status === 403 || res.status === 400) {
    const body = await res.text();
    return {
      status: "unknown",
      meta: {
        method: "youtube_data_api",
        note: `YouTube Data API rejected the key/request (HTTP ${res.status})`,
        detail: body.slice(0, 200),
      },
    };
  }
  if (!res.ok) {
    return {
      status: "unknown",
      meta: {
        method: "youtube_data_api",
        note: `Unexpected HTTP ${res.status}`,
      },
    };
  }

  const data = (await res.json()) as {
    items?: Array<{ id?: string; snippet?: { title?: string; customUrl?: string } }>;
  };
  const item = data.items?.[0];
  if (item?.id) {
    return {
      status: "taken",
      profileUrl: `https://www.youtube.com/@${encodeURIComponent(handle)}`,
      meta: {
        method: "youtube_data_api",
        channelId: item.id,
        title: item.snippet?.title,
      },
    };
  }

  return {
    status: "available",
    meta: {
      method: "youtube_data_api",
      note: "No channel for this handle — reserved names may still be blocked.",
    },
  };
}

async function checkViaPublicHandle(handle: string): Promise<CheckResult> {
  const profileUrl = `https://www.youtube.com/@${encodeURIComponent(handle)}`;
  const res = await fetchWithTimeout(profileUrl, {
    method: "GET",
    headers: {
      "User-Agent": BROWSER_UA,
      Accept: "text/html",
    },
    redirect: "follow",
  });

  if (res.status === 200) {
    return {
      status: "taken",
      profileUrl,
      meta: {
        method: "youtube_handle_page",
        note: "Best-effort @handle HTTP probe; prefer YOUTUBE_API_KEY.",
      },
    };
  }
  if (res.status === 404) {
    return {
      status: "available",
      meta: {
        method: "youtube_handle_page",
        note: "No public @handle page — reserved names may still be unavailable.",
      },
    };
  }

  return {
    status: "unknown",
    meta: {
      method: "youtube_handle_page",
      note: `Unexpected HTTP ${res.status}`,
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
        meta: {
          note: "YouTube handles are 3–30 chars: letters, numbers, ., -, _",
        },
      };
    }

    try {
      const apiKey = process.env.YOUTUBE_API_KEY?.trim();
      if (apiKey) {
        return await checkViaDataApi(handle, apiKey);
      }
      return await checkViaPublicHandle(handle);
    } catch (err) {
      return {
        status: "unknown",
        meta: {
          note: isAbortError(err)
            ? "YouTube check timed out"
            : err instanceof Error
              ? err.message
              : "YouTube check failed",
        },
      };
    }
  },
};
