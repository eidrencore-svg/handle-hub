import type { PlatformAdapter, CheckResult } from "./types";
import { BROWSER_UA, SLOW_TIMEOUT_MS, browserHeaders, extractMeta, fetchWithTimeout, looksLikeChallenge } from "./http";
import { runChain, unknown, type Step } from "./chain";
import { buildProfile, parseCount, sanitizeBio } from "./profile";

const HANDLE_RE = /^[A-Za-z0-9._]{1,30}$/;
/** Instagram's public web app id (same value instagram.com sends; rule from Maigret). */
const IG_WEB_APP_ID = process.env.INSTAGRAM_APP_ID?.trim() || "936619743392459";

type IgUser = {
  id?: string;
  username?: string;
  full_name?: string;
  biography?: string;
  profile_pic_url?: string;
  profile_pic_url_hd?: string;
  is_verified?: boolean;
  edge_followed_by?: { count?: number };
  edge_follow?: { count?: number };
  edge_owner_to_timeline_media?: { count?: number };
};

const profileUrlFor = (u: string) => `https://www.instagram.com/${encodeURIComponent(u)}/`;

function takenFromUser(username: string, user: IgUser, method: string): CheckResult {
  return {
    status: "taken",
    confidence: "high",
    reason: "ok",
    profileUrl: profileUrlFor(username),
    profile: buildProfile({
      displayName: user.full_name || user.username,
      avatarUrl: user.profile_pic_url_hd || user.profile_pic_url,
      bio: sanitizeBio(user.biography),
      followers: user.edge_followed_by?.count,
      following: user.edge_follow?.count,
      posts: user.edge_owner_to_timeline_media?.count,
      verified: user.is_verified,
    }),
    meta: { method, userId: user.id },
  };
}

const available = (method: string, devNote: string): CheckResult => ({
  status: "available",
  confidence: "medium",
  reason: "best_effort",
  meta: { method, devNote },
});

/** Instagram's own web API (no login): 200 + user → taken, 404 → no such account. */
async function webProfileInfo(username: string, host: "www.instagram.com" | "i.instagram.com", method: string): Promise<CheckResult> {
  const res = await fetchWithTimeout(`https://${host}/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`, {
    headers: {
      "User-Agent": BROWSER_UA,
      Accept: "*/*",
      "Accept-Language": "en-US,en;q=0.9",
      "X-IG-App-ID": IG_WEB_APP_ID,
      "X-Requested-With": "XMLHttpRequest",
      Referer: `https://www.instagram.com/${encodeURIComponent(username)}/`,
    },
    redirect: "manual",
    timeoutMs: SLOW_TIMEOUT_MS,
  });
  const body = await res.text();
  const isJson = body.trimStart().startsWith("{");
  if (res.status >= 300 && res.status < 400) {
    return unknown(method, "rate_limited", `redirected to ${res.headers.get("location") ?? "?"} (login wall)`);
  }
  if (res.status === 401 || res.status === 403 || res.status === 429 || /require_login|wait a few minutes/i.test(body)) {
    return unknown(method, "rate_limited", `HTTP ${res.status}: Instagram asked for a login (it rate-limits anonymous lookups per network)`);
  }
  if (res.status === 200 && isJson) {
    const data = JSON.parse(body) as { data?: { user?: IgUser | null }; status?: string };
    const user = data.data?.user;
    if (user && (user.id || user.username)) {
      if (user.username && user.username.toLowerCase() !== username.toLowerCase()) {
        return unknown(method, "unexpected_response", `API returned a different account (${user.username})`);
      }
      return takenFromUser(username, user, method);
    }
    if (data.data && user === null && data.status === "ok") {
      return available(method, "Instagram's web API returned no account for this username.");
    }
    return unknown(method, "unexpected_response", "200 without a user object");
  }
  if (res.status === 404 && (isJson || body.trim() === "")) {
    return available(method, "Instagram's web API returned 404 (no account) — Instagram may still reserve some names.");
  }
  if (looksLikeChallenge(body, res.status)) return unknown(method, "platform_blocked", `challenge page (HTTP ${res.status})`);
  return unknown(method, "unexpected_response", `HTTP ${res.status}`);
}

/** Public profile page: og:description "… Followers … (@user)" → taken; "Sorry, this page isn't available" / 404 → no account. */
async function profilePage(username: string): Promise<CheckResult> {
  const method = "profile_html";
  const res = await fetchWithTimeout(profileUrlFor(username), {
    headers: browserHeaders(),
    redirect: "manual",
    timeoutMs: SLOW_TIMEOUT_MS,
  });
  if (res.status >= 300 && res.status < 400) {
    const loc = res.headers.get("location") ?? "";
    return unknown(method, /login/.test(loc) ? "rate_limited" : "unexpected_response", `redirected to ${loc.slice(0, 80)}`);
  }
  const html = await res.text();
  const desc = extractMeta(html, "og:description") ?? extractMeta(html, "description") ?? "";
  const title = extractMeta(html, "og:title") ?? "";
  const handleRe = new RegExp(`\\(@${username.replace(/\./g, "\\.")}\\)`, "i");
  if (res.status === 200 && (handleRe.test(desc) || handleRe.test(title)) && /followers|posts/i.test(desc)) {
    const m = desc.match(/([\d.,]+[KMB]?) Followers, ([\d.,]+[KMB]?) Following, ([\d.,]+[KMB]?) Posts/i);
    return {
      status: "taken",
      confidence: "high",
      reason: "ok",
      profileUrl: profileUrlFor(username),
      profile: buildProfile({
        displayName: title.replace(/\s*\(@[^)]*\).*$/, "").trim() || undefined,
        avatarUrl: extractMeta(html, "og:image"),
        followers: parseCount(m?.[1]),
        following: parseCount(m?.[2]),
        posts: parseCount(m?.[3]),
      }),
      meta: { method },
    };
  }
  if (res.status === 404 || /Sorry, this page isn(?:&#39;|'|’)t available/i.test(html)) {
    return available(method, "Instagram's profile page says this page isn't available.");
  }
  if (looksLikeChallenge(html, res.status)) return unknown(method, "platform_blocked", "challenge page");
  // A logged-out shell page without profile data means Instagram withheld the answer.
  return unknown(method, "rate_limited", `HTTP ${res.status} page without profile data (logged-out shell)`);
}

export const instagramAdapter: PlatformAdapter = {
  id: "instagram",
  name: "Instagram",
  kind: "social",
  async checkUsername(username, ctx) {
    if (!HANDLE_RE.test(username) || !/[A-Za-z0-9]/.test(username)) {
      return {
        status: "invalid",
        reason: "invalid_format",
        confidence: "high",
        meta: { method: "validation", devNote: "Instagram usernames are 1–30 chars: letters, numbers, periods, underscores" },
      };
    }
    const api: Step = { method: "web_profile_info", run: () => webProfileInfo(username, "www.instagram.com", "web_profile_info") };
    const apiMobileHost: Step = { method: "web_profile_info_i", run: () => webProfileInfo(username, "i.instagram.com", "web_profile_info_i") };
    const page: Step = { method: "profile_html", run: () => profilePage(username) };
    const steps = ctx?.pass === 2 ? [page, apiMobileHost, api] : [api, apiMobileHost, page];
    const result = await runChain(steps);
    if (result.status === "unknown") {
      result.meta = {
        ...result.meta,
        devNote:
          "Instagram withheld the answer from this network (anonymous lookups are rate-limited per IP; datacenter IPs are always blocked). Confirm on instagram.com, or use the official Graph API for business accounts.",
      };
    }
    return result;
  },
};
