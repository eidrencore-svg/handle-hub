/**
 * Per-platform username rules, checked before any network request so an
 * invalid handle gets a specific explanation ("Xbox gamertags can't contain
 * “_”") instead of a generic error. Sources: each platform's signup/help pages
 * (Xbox: Microsoft GDK "modern gamertags" docs — letters, numbers, spaces; "_"
 * is a restricted symbol players can't use).
 */
export type HandleRule = {
  /** Platform display name used in messages. */
  name: string;
  noun: string;
  min: number;
  max: number;
  /** One allowed character. */
  char: RegExp;
  charsText: string;
  /** Extra structural checks; return a message or null. */
  extra?: (u: string) => string | null;
  /** Suggest a nearby valid handle. */
  suggest?: (u: string) => string[];
};

const q = (s: string) => `“${s}”`;

export const RULES: Record<string, HandleRule> = {
  steam: { name: "Steam", noun: "custom URLs", min: 2, max: 32, char: /[A-Za-z0-9_-]/, charsText: "letters, numbers, _ and -" },
  xbox: {
    name: "Xbox",
    noun: "gamertags",
    min: 1,
    max: 15,
    char: /[A-Za-z0-9 ]/,
    charsText: "letters, numbers and spaces (new gamertags: up to 12 characters)",
    suggest: (u) => {
      const spaced = u.replace(/[^A-Za-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 12).trim();
      const joined = u.replace(/[^A-Za-z0-9]+/g, "").slice(0, 12);
      return [...new Set([spaced, joined])].filter((s) => s.length > 0);
    },
  },
  playstation: {
    name: "PlayStation",
    noun: "online IDs",
    min: 3,
    max: 16,
    char: /[A-Za-z0-9_-]/,
    charsText: "letters, numbers, _ and -",
    extra: (u) => (/^[A-Za-z]/.test(u) ? null : "PlayStation online IDs must start with a letter."),
  },
  twitch: { name: "Twitch", noun: "usernames", min: 4, max: 25, char: /[A-Za-z0-9_]/, charsText: "letters, numbers and _" },
  twitter: { name: "X", noun: "handles", min: 1, max: 15, char: /[A-Za-z0-9_]/, charsText: "letters, numbers and _" },
  instagram: {
    name: "Instagram",
    noun: "usernames",
    min: 1,
    max: 30,
    char: /[A-Za-z0-9._]/,
    charsText: "letters, numbers, periods and underscores",
    extra: (u) =>
      /^\.|\.$/.test(u)
        ? "Instagram usernames can't start or end with a period."
        : /\.\./.test(u)
          ? "Instagram usernames can't contain two periods in a row."
          : null,
  },
  tiktok: {
    name: "TikTok",
    noun: "usernames",
    min: 2,
    max: 24,
    char: /[A-Za-z0-9._]/,
    charsText: "letters, numbers, periods and underscores",
    extra: (u) => (/\.$/.test(u) ? "TikTok usernames can't end with a period." : null),
  },
  discord: {
    name: "Discord",
    noun: "usernames",
    min: 2,
    max: 32,
    char: /[A-Za-z0-9._]/,
    charsText: "letters, numbers, periods and underscores (stored lowercase)",
    extra: (u) => (/\.\./.test(u) ? "Discord usernames can't contain two periods in a row." : null),
  },
  reddit: { name: "Reddit", noun: "usernames", min: 3, max: 20, char: /[A-Za-z0-9_-]/, charsText: "letters, numbers, _ and -" },
  youtube: { name: "YouTube", noun: "handles", min: 3, max: 30, char: /[A-Za-z0-9._-]/, charsText: "letters, numbers, _, - and ." },
};

const charLabel = (c: string) => (c === " " ? "spaces" : q(c));
const orList = (xs: string[]) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} or ${xs[xs.length - 1]}`);

/** Returns a user-facing explanation if `username` can't exist on the platform, else null. */
export function validateHandle(platformId: string, username: string): string | null {
  const rule = RULES[platformId];
  if (!rule) return null;
  const bad = [...new Set([...username].filter((c) => !rule.char.test(c)))];
  let msg: string | null = null;
  if (bad.length) {
    msg = `${rule.name} ${rule.noun} can't contain ${orList(bad.map(charLabel))} — only ${rule.charsText}.`;
  } else if (username.length < rule.min || username.length > rule.max) {
    msg = `${rule.name} ${rule.noun} must be ${rule.min}–${rule.max} characters (this one has ${username.length}).`;
  } else if (rule.extra) {
    msg = rule.extra(username);
  }
  if (!msg) return null;
  const ideas = rule.suggest?.(username).filter((s) => s !== username && !validateHandleBasic(rule, s)) ?? [];
  if (ideas.length) msg += ` Try ${orList(ideas.map(q))}.`;
  return msg;
}

function validateHandleBasic(rule: HandleRule, u: string): boolean {
  return [...u].some((c) => !rule.char.test(c)) || u.length < rule.min || u.length > rule.max;
}

/** Public page where a person can confirm the result by hand (null if the platform has none). */
export function manualCheckUrl(platformId: string, username: string): string | null {
  const u = encodeURIComponent(username);
  switch (platformId) {
    case "steam":
      return `https://steamcommunity.com/id/${u}`;
    case "xbox":
      return `https://www.xbox.com/play/user/${u}`;
    case "playstation":
      return `https://psnprofiles.com/${u}`;
    case "twitch":
      return `https://www.twitch.tv/${u.toLowerCase()}`;
    case "twitter":
      return `https://x.com/${u}`;
    case "instagram":
      return `https://www.instagram.com/${u}/`;
    case "tiktok":
      return `https://www.tiktok.com/@${u}`;
    case "reddit":
      return `https://www.reddit.com/user/${u}/`;
    case "youtube":
      return `https://www.youtube.com/@${u}`;
    default:
      return null; // Discord has no public profile pages by username.
  }
}
