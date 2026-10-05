/** Public profile fields shown on taken cards. */
export type ProfileInfo = {
  displayName?: string;
  avatarUrl?: string;
  bio?: string;
  followers?: number;
  following?: number;
  posts?: number;
  verified?: boolean;
  extra?: Record<string, string | number | boolean>;
};

/** Strip HTML/BBCode-ish markup to plain text for bios. */
export function sanitizeBio(raw: string | undefined | null, max = 280): string | undefined {
  if (!raw) return undefined;
  let s = String(raw);
  s = s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/gi, "$1");
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(/<\/p>/gi, "\n");
  s = s.replace(/<[^>]+>/g, "");
  s = s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\\u002F/g, "/")
    .replace(/\\n/g, "\n");
  s = s.replace(/[\u2800\u200b-\u200d\u2060\ufeff]/g, " ");
  s = s.replace(/[ \t\u00a0]{2,}/g, " ");
  s = s.replace(/[ \t]+\n/g, "\n").replace(/\n[ \t]+/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!s) return undefined;
  if (s.length > max) s = s.slice(0, max - 1).trimEnd() + "…";
  return s;
}

export function parseCount(raw: string | number | undefined | null): number | undefined {
  if (raw == null) return undefined;
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.max(0, Math.floor(raw));
  const s = String(raw)
    .trim()
    .toLowerCase()
    .replace(/,/g, "")
    .replace(/\bthousand\b/g, "k")
    .replace(/\bmillion\b/g, "m")
    .replace(/\bbillion\b/g, "b");
  const m = s.match(/^([\d.]+)\s*([kmb])?(?:\s|$)/i) || s.match(/([\d.]+)\s*([kmb])\b/i);
  if (m) {
    let n = parseFloat(m[1]);
    if (!Number.isFinite(n)) return undefined;
    const u = (m[2] || "").toLowerCase();
    if (u === "k") n *= 1_000;
    else if (u === "m") n *= 1_000_000;
    else if (u === "b") n *= 1_000_000_000;
    return Math.round(n);
  }
  const digits = s.replace(/[^\d]/g, "");
  if (!digits) return undefined;
  return parseInt(digits, 10);
}

/** Compact formatter: 12.3K, 1.2M */
export function formatCount(n: number | undefined): string | undefined {
  if (n == null || !Number.isFinite(n)) return undefined;
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1).replace(/\.0$/, "")}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(Math.round(n));
}

export function buildProfile(partial: ProfileInfo): ProfileInfo | undefined {
  const profile: ProfileInfo = {};
  if (partial.displayName?.trim()) profile.displayName = partial.displayName.trim().slice(0, 80);
  if (partial.avatarUrl?.trim()) profile.avatarUrl = partial.avatarUrl.trim();
  const bio = sanitizeBio(partial.bio);
  if (bio) profile.bio = bio;
  if (typeof partial.followers === "number") profile.followers = partial.followers;
  if (typeof partial.following === "number") profile.following = partial.following;
  if (typeof partial.posts === "number") profile.posts = partial.posts;
  if (typeof partial.verified === "boolean") profile.verified = partial.verified;
  if (partial.extra && Object.keys(partial.extra).length) profile.extra = partial.extra;
  return Object.keys(profile).length ? profile : undefined;
}

export function xmlTag(body: string, tag: string): string | undefined {
  const re = new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, "i");
  const m = body.match(re);
  return m?.[1]?.trim() || undefined;
}
