export type FilterKey = "all" | "available" | "taken" | "unknown" | "invalid";

/** Locked status language: Available · Taken · Couldn't verify · Invalid. */
export const STATUS_LABEL: Record<string, string> = {
  available: "Available",
  taken: "Taken",
  unknown: "Couldn't verify",
  invalid: "Invalid",
};

export function statusLabel(status: string): string {
  return STATUS_LABEL[status] ?? STATUS_LABEL.unknown;
}

export const FILTERS: { id: FilterKey; label: string }[] = [
  { id: "all", label: "All" },
  { id: "available", label: "Available" },
  { id: "taken", label: "Taken" },
  { id: "unknown", label: "Couldn't verify" },
  { id: "invalid", label: "Invalid" },
];

/** Available = emerald, Taken = rose, Unknown = amber, Invalid = orange. */
export function statusBadgeClasses(status: string): string {
  switch (status) {
    case "available":
      return "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30";
    case "taken":
      return "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30";
    case "invalid":
      return "bg-orange-500/15 text-orange-300 ring-1 ring-orange-500/30";
    default:
      return "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30";
  }
}

export function statusTextClass(status: string): string {
  switch (status) {
    case "available":
      return "text-emerald-300";
    case "taken":
      return "text-rose-300";
    case "invalid":
      return "text-orange-300";
    default:
      return "text-amber-300";
  }
}

export function statusDotClass(status: string): string {
  switch (status) {
    case "available":
      return "bg-emerald-400";
    case "taken":
      return "bg-rose-400";
    case "invalid":
      return "bg-orange-400";
    default:
      return "bg-amber-400";
  }
}

export function kindLabel(kind: string): string {
  return kind === "gaming" ? "Gaming" : "Social";
}

/** Where to go to grab a free handle on each core platform. */
export const CLAIM_URLS: Record<string, string> = {
  steam: "https://store.steampowered.com/join",
  xbox: "https://social.xbox.com/changegamertag",
  playstation: "https://www.playstation.com/en-us/support/account/change-psn-online-id/",
  twitch: "https://www.twitch.tv/signup",
  discord: "https://discord.com/register",
  twitter: "https://x.com/i/flow/signup",
  instagram: "https://www.instagram.com/accounts/emailsignup/",
  tiktok: "https://www.tiktok.com/signup",
  reddit: "https://www.reddit.com/register/",
  youtube: "https://www.youtube.com/handle",
};
