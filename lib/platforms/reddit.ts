import type { PlatformAdapter, CheckResult } from "./types";
import { SLOW_TIMEOUT_MS, browserHeaders, fetchWithRetry, fetchWithTimeout } from "./http";
import { runChain, unknown, type Step } from "./chain";
import { buildProfile, sanitizeBio } from "./profile";

const REDDIT_RE = /^[A-Za-z0-9_-]{3,20}$/;
/** Reddit's API rules ask for a unique, descriptive User-Agent. */
const REDDIT_UA =
  "web:handle-hub:v0.2 (username availability check; +https://github.com/eidrencore-svg/handle-hub)";
const profileUrlFor = (u: string) => `https://www.reddit.com/user/${encodeURIComponent(u)}`;

/** Reddit answers blocked networks with an HTML "network security" page instead of JSON. */
function blockedHtml(res: Response, body: string): boolean {
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  return ct.includes("text/html") || /whoa there, pardner|blocked by network security/i.test(body) || (/<html[\s>]/i.test(body) && !body.trimStart().startsWith("{"));
}

type AboutData = {
  name?: string;
  is_suspended?: boolean;
  icon_img?: string;
  snoovatar_img?: string;
  total_karma?: number;
  subreddit?: { public_description?: string; title?: string };
};

function takenFromAbout(username: string, d: AboutData, method: string, confidence: "high" | "medium"): CheckResult {
  const avatar = (d.snoovatar_img || d.icon_img || "").split("?")[0] || undefined;
  return {
    status: "taken",
    confidence,
    reason: confidence === "high" ? "ok" : "best_effort",
    profileUrl: profileUrlFor(username),
    profile: buildProfile({
      displayName: d.subreddit?.title || d.name,
      avatarUrl: avatar,
      bio: sanitizeBio(d.subreddit?.public_description),
      extra: typeof d.total_karma === "number" ? { karma: d.total_karma } : undefined,
    }),
    meta: { method, suspended: Boolean(d.is_suspended) },
  };
}

/**
 * Public about.json (www or old.reddit.com). 200 → taken. 404 means "no live
 * account", which is NOT the same as available (deleted names can never be
 * re-registered), so it's only a hint for the signup check below.
 */
async function aboutJson(username: string, host: "www.reddit.com" | "old.reddit.com", method: string, hint: { notFound?: boolean }): Promise<CheckResult> {
  const res = await fetchWithTimeout(`https://${host}/user/${encodeURIComponent(username)}/about.json?raw_json=1`, {
    headers: { "User-Agent": REDDIT_UA, Accept: "application/json" },
    redirect: "manual",
    timeoutMs: SLOW_TIMEOUT_MS,
  });
  const body = await res.text();
  if (res.status >= 300 && res.status < 400) return unknown(method, "platform_blocked", `redirected to ${res.headers.get("location")?.slice(0, 80) ?? "?"}`);
  if (res.status === 429) return unknown(method, "rate_limited", "HTTP 429");
  if (blockedHtml(res, body)) return unknown(method, "platform_blocked", `HTTP ${res.status} HTML block page (Reddit blocks anonymous JSON from many networks)`);
  if (res.status === 404) {
    hint.notFound = true;
    return unknown(method, "unexpected_response", "404: no live account (deleted names stay blocked) — confirming with the signup check");
  }
  if (res.status === 200) {
    const json = JSON.parse(body) as { kind?: string; data?: AboutData };
    if (json.data?.name) {
      if (json.data.name.toLowerCase() !== username.toLowerCase()) return unknown(method, "unexpected_response", `different account (${json.data.name})`);
      return takenFromAbout(username, json.data, method, "high");
    }
  }
  return unknown(method, "unexpected_response", `HTTP ${res.status}`);
}

/** Reddit's signup check: "true" → available, "false" → taken (also covers deleted/banned names). */
async function usernameAvailable(username: string): Promise<CheckResult> {
  const method = "username_available";
  const res = await fetchWithTimeout(`https://www.reddit.com/api/username_available.json?user=${encodeURIComponent(username)}`, {
    headers: { "User-Agent": REDDIT_UA, Accept: "application/json" },
    redirect: "manual",
    timeoutMs: SLOW_TIMEOUT_MS,
  });
  const body = (await res.text()).trim();
  if (res.status === 429) return unknown(method, "rate_limited", "HTTP 429");
  if (blockedHtml(res, body)) return unknown(method, "platform_blocked", `HTTP ${res.status} HTML block page`);
  if (res.status === 200 && (body === "true" || body === "false")) {
    return body === "true"
      ? { status: "available", confidence: "high", reason: "ok", meta: { method } }
      : { status: "taken", confidence: "high", reason: "ok", profileUrl: profileUrlFor(username), meta: { method, devNote: "Reddit's signup check says this name can't be registered (in use, deleted or banned)." } };
  }
  return unknown(method, "unexpected_response", `HTTP ${res.status}`);
}

/** Profile page HTML (normal browser request): "nobody on Reddit goes by that name" → no live account. */
async function profilePage(username: string, hint: { notFound?: boolean }): Promise<CheckResult> {
  const method = "profile_html";
  const res = await fetchWithTimeout(`${profileUrlFor(username)}/`, { headers: browserHeaders(), timeoutMs: SLOW_TIMEOUT_MS });
  const html = await res.text();
  if (/nobody on Reddit goes by that name/i.test(html)) {
    hint.notFound = true;
    return unknown(method, "unexpected_response", "page: nobody goes by that name (deleted names stay blocked)");
  }
  const name = username.replace(/[-]/g, "\\-");
  if (res.status === 200 && new RegExp(`<title>(?:[^<]*[\\s(])?u/${name}(?![A-Za-z0-9_-])[^<]*</title>`, "i").test(html)) {
    return { status: "taken", confidence: "medium", reason: "best_effort", profileUrl: profileUrlFor(username), meta: { method } };
  }
  if (res.status === 403 || /blocked by network security|prove your humanity/i.test(html)) return unknown(method, "platform_blocked", `HTTP ${res.status} block page`);
  return unknown(method, "unexpected_response", `HTTP ${res.status} page without profile markers`);
}

let redditToken: { token: string; expiresAt: number } | null = null;

/**
 * Official Reddit API (app-only OAuth, client_credentials). Works from
 * datacenter IPs where www.reddit.com JSON is blocked. Needs a free "script"
 * or "web" app: REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET.
 */
async function checkViaOAuth(username: string, id: string, secret: string): Promise<CheckResult | null> {
  if (!redditToken || Date.now() > redditToken.expiresAt - 60_000) {
    const res = await fetchWithRetry("https://www.reddit.com/api/v1/access_token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": REDDIT_UA,
      },
      body: "grant_type=client_credentials",
      maxRetries: 1,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) return null;
    redditToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
  }
  const res = await fetchWithRetry(`https://oauth.reddit.com/user/${encodeURIComponent(username)}/about`, {
    headers: { Authorization: `Bearer ${redditToken.token}`, "User-Agent": REDDIT_UA, Accept: "application/json" },
    maxRetries: 1,
  });
  if (res.status === 404) {
    return {
      status: "available",
      confidence: "medium",
      reason: "best_effort",
      meta: { method: "reddit_oauth", devNote: "No account found — deleted usernames can never be re-registered on Reddit." },
    };
  }
  if (!res.ok) return null;
  const json = (await res.json()) as { data?: Record<string, unknown> };
  const d = (json.data ?? {}) as {
    name?: string;
    is_suspended?: boolean;
    icon_img?: string;
    snoovatar_img?: string;
    total_karma?: number;
    subreddit?: { public_description?: string; title?: string };
  };
  if (!d.name) return null;
  const avatar = (d.snoovatar_img || d.icon_img || "").split("?")[0] || undefined;
  return {
    status: "taken",
    confidence: "high",
    reason: "ok",
    profileUrl: `https://www.reddit.com/user/${encodeURIComponent(username)}`,
    profile: buildProfile({
      displayName: d.subreddit?.title || d.name,
      avatarUrl: avatar,
      bio: sanitizeBio(d.subreddit?.public_description),
      extra: typeof d.total_karma === "number" ? { karma: d.total_karma } : undefined,
    }),
    meta: { method: "reddit_oauth", suspended: Boolean(d.is_suspended) },
  };
}

export const redditAdapter: PlatformAdapter = {
  id: "reddit",
  name: "Reddit",
  kind: "social",
  async checkUsername(username, ctx) {
    if (!REDDIT_RE.test(username)) {
      return {
        status: "invalid",
        reason: "invalid_format",
        confidence: "high",
        meta: { method: "validation", devNote: "Reddit usernames are 3–20 characters: letters, numbers, _ or -" },
      };
    }
    const hint: { notFound?: boolean } = {};
    const id = process.env.REDDIT_CLIENT_ID?.trim();
    const secret = process.env.REDDIT_CLIENT_SECRET?.trim();
    const oauth: Step | null =
      id && secret
        ? {
            method: "reddit_oauth",
            run: async () => (await checkViaOAuth(username, id, secret)) ?? unknown("reddit_oauth", "auth_failed", "OAuth token or lookup failed"),
          }
        : null;
    const about: Step = { method: "user_about", run: () => aboutJson(username, "www.reddit.com", "user_about", hint) };
    const oldAbout: Step = { method: "old_user_about", run: () => aboutJson(username, "old.reddit.com", "old_user_about", hint) };
    const signup: Step = { method: "username_available", run: () => usernameAvailable(username) };
    const page: Step = { method: "profile_html", run: () => profilePage(username, hint) };
    const order = ctx?.pass === 2 ? [signup, page, oldAbout, about] : [about, signup, oldAbout, page];
    const result = await runChain([...(oauth ? [oauth] : []), ...order]);
    if (result.status === "unknown" && hint.notFound) {
      // A public endpoint saw no live account, but the signup check couldn't confirm it.
      return {
        status: "available",
        confidence: "medium",
        reason: "best_effort",
        meta: {
          ...result.meta,
          method: "user_about_404",
          userMessage: "No Reddit account uses this name. If it belonged to a deleted account, Reddit won't let it be registered again.",
          devNote: "No live Reddit account found; Reddit's signup check couldn't be reached. Deleted usernames can never be re-registered.",
        },
      };
    }
    if (result.status === "unknown" && !oauth) {
      result.meta = { ...result.meta, devNote: "Reddit blocked anonymous checks from this network. Free fix: set REDDIT_CLIENT_ID/REDDIT_CLIENT_SECRET (official API)." };
    }
    return result;
  },
};
