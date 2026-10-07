"use client";

import { useState } from "react";
import { PlatformIcon, PlatformTile } from "@/components/PlatformIcon";
import { CLAIM_URLS, kindLabel, statusBadgeClasses, statusLabel } from "@/components/statusStyles";
import { formatCount, type ProfileInfo } from "@/lib/platforms/profile";

export type CheckResult = {
  platformId: string;
  platformName: string;
  kind: string;
  status: string;
  profileUrl?: string;
  reason?: string;
  userMessage?: string;
  estimate?: boolean;
  confidence?: "high" | "medium" | "low";
  cached?: boolean;
  /** Public page where the user can confirm by hand. */
  checkUrl?: string | null;
  pass?: number;
  profile?: ProfileInfo;
  meta?: Record<string, unknown>;
};

function avatarSrc(url?: string): string | undefined {
  if (!url) return undefined;
  return `/api/avatar?url=${encodeURIComponent(url)}`;
}

function VerifiedBadge() {
  return (
    <span
      className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-sky-500/20 text-[10px] text-sky-300 ring-1 ring-sky-400/40"
      title="Verified"
      aria-label="Verified"
    >
      ✓
    </span>
  );
}

function ProfileBlock({
  profile,
  platformId,
  platformName,
}: {
  profile: ProfileInfo;
  platformId: string;
  platformName: string;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const src = imgFailed ? undefined : avatarSrc(profile.avatarUrl);
  const counts: string[] = [];
  const f = formatCount(profile.followers);
  const g = formatCount(profile.following);
  const p = formatCount(profile.posts);
  const followerNoun =
    platformId === "youtube" ? "subscribers" : "followers";
  if (f) counts.push(`${f} ${followerNoun}`);
  if (g) counts.push(`${g} following`);
  const postNoun =
    platformId === "youtube" || platformId === "tiktok" ? "videos" : "posts";
  if (p) counts.push(`${p} ${postNoun}`);
  const likes = profile.extra?.likes;
  if (typeof likes === "number") {
    const l = formatCount(likes);
    if (l) counts.push(`${l} likes`);
  }
  const karma = profile.extra?.karma;
  if (typeof karma === "number") {
    const k = formatCount(karma);
    if (k) counts.push(`${k} karma`);
  }
  const subs = profile.extra?.subscribersLabel;
  if (typeof subs === "string" && !f) counts.unshift(subs);

  return (
    <div className="mt-3 flex gap-3 rounded-xl border border-white/5 bg-ink-950/40 p-3">
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border border-white/10 bg-ink-900">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <PlatformIcon
              platformId={platformId}
              className="h-5 w-5"
              title={platformName}
            />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-sm font-semibold text-white">
            {profile.displayName || "Profile"}
          </p>
          {profile.verified ? <VerifiedBadge /> : null}
        </div>
        {profile.bio ? (
          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-400">
            {profile.bio}
          </p>
        ) : null}
        {counts.length > 0 ? (
          <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
            {counts.join(" · ")}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ExternalIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" aria-hidden fill="currentColor">
      <path d="M11 3h6v6h-2V6.41l-6.3 6.3-1.4-1.42L13.58 5H11V3z" />
      <path d="M5 5h4v2H5v8h8v-4h2v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
    </svg>
  );
}

function RetryIcon({ spinning }: { spinning?: boolean }) {
  return (
    <svg viewBox="0 0 20 20" className={`h-3.5 w-3.5 ${spinning ? "animate-spin" : ""}`} aria-hidden fill="currentColor">
      <path d="M10 3a7 7 0 0 1 6.32 4H14v2h5V4h-2v1.68A9 9 0 1 0 19 11h-2a7 7 0 1 1-7-8z" />
    </svg>
  );
}

const DISCORD_HINT = "Discord has no public profile pages. Confirm in Discord under Settings, My Account, Username.";

function quietConfidence(c?: string, estimate?: boolean): string | null {
  if (c === "high") return "High confidence";
  if (c === "medium") return "Medium confidence";
  if (c === "low") return estimate ? "Low confidence, estimate" : "Low confidence";
  if (estimate) return "Estimate";
  return null;
}

function defaultReason(status: string, platformName: string): string {
  switch (status) {
    case "available":
      return `Looks free on ${platformName}.`;
    case "taken":
      return `Someone already uses this on ${platformName}.`;
    case "invalid":
      return `${platformName} doesn't allow this format.`;
    default:
      return `${platformName} didn't give a clear answer. Retry, or check on ${platformName}.`;
  }
}

const primaryBtn =
  "inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:w-auto sm:py-2";
const secondaryBtn =
  "inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-200 ring-1 ring-white/10 transition hover:bg-white/5 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60 sm:flex-none";

export function PlatformCard({
  result,
  onRetry,
  retrying = false,
}: {
  result: CheckResult;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  const { status } = result;
  const isUnknown = status !== "available" && status !== "taken" && status !== "invalid";
  const conf = status === "available" || status === "taken" ? quietConfidence(result.confidence, result.estimate) : null;
  const showProfile = status === "taken" && result.profile;
  const claimUrl = status === "available" ? CLAIM_URLS[result.platformId] : undefined;
  const reason =
    result.userMessage ||
    (isUnknown && result.platformId === "discord" ? DISCORD_HINT : defaultReason(status, result.platformName));

  return (
    <article
      className={`flex flex-col rounded-2xl border bg-ink-800/70 p-4 shadow-card backdrop-blur transition hover:bg-ink-700/80 ${
        status === "available"
          ? "border-emerald-400/20 hover:border-emerald-400/40"
          : isUnknown
            ? "border-amber-300/15 hover:border-amber-300/30"
            : "border-white/10 hover:border-white/20"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <PlatformTile platformId={result.platformId} title={result.platformName} />
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-white">{result.platformName}</h3>
            <p className="text-[11px] uppercase tracking-wide text-slate-500">{kindLabel(result.kind)}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClasses(status)}`}>
            {statusLabel(status)}
          </span>
          {conf ? <span className="text-[10px] text-slate-500">{conf}{result.cached ? " · cached" : ""}</span> : null}
        </div>
      </div>

      <p
        className={`mt-3 text-xs leading-relaxed ${
          status === "invalid" ? "text-orange-200/90" : isUnknown ? "text-amber-100/80" : "line-clamp-2 text-slate-400"
        }`}
      >
        {reason}
      </p>

      {showProfile ? (
        <ProfileBlock profile={result.profile!} platformId={result.platformId} platformName={result.platformName} />
      ) : null}

      <div className="mt-auto pt-4">
        {status === "available" ? (
          claimUrl ? (
            <a
              href={claimUrl}
              target="_blank"
              rel="noreferrer nofollow"
              className={`${primaryBtn} bg-emerald-500/90 text-ink-950 hover:bg-emerald-400`}
            >
              Claim on {result.platformName}
              <ExternalIcon />
            </a>
          ) : null
        ) : status === "taken" ? (
          result.profileUrl ? (
            <a
              href={result.profileUrl}
              target="_blank"
              rel="noreferrer"
              className={`${primaryBtn} bg-white/10 text-white ring-1 ring-white/15 hover:bg-white/15`}
            >
              Open profile
              <ExternalIcon />
            </a>
          ) : null
        ) : isUnknown ? (
          <div className="flex flex-wrap gap-2">
            {onRetry ? (
              <button type="button" onClick={onRetry} disabled={retrying} className={secondaryBtn}>
                <RetryIcon spinning={retrying} />
                {retrying ? "Retrying…" : "Retry"}
              </button>
            ) : null}
            {result.checkUrl ? (
              <a href={result.checkUrl} target="_blank" rel="noreferrer nofollow" className={secondaryBtn}>
                Check on site
                <ExternalIcon />
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-white/5 bg-ink-800/50 p-4">
      <div className="flex items-start justify-between">
        <div className="flex gap-3">
          <div className="h-9 w-9 rounded-xl bg-slate-700/50" />
          <div className="space-y-2">
            <div className="h-4 w-24 rounded bg-slate-700/70" />
            <div className="h-3 w-14 rounded bg-slate-700/40" />
          </div>
        </div>
        <div className="h-6 w-16 rounded-full bg-slate-700/50" />
      </div>
      <div className="mt-3 flex gap-3 rounded-xl border border-white/5 bg-ink-950/30 p-3">
        <div className="h-12 w-12 rounded-full bg-slate-700/50" />
        <div className="flex-1 space-y-2 pt-1">
          <div className="h-3 w-28 rounded bg-slate-700/60" />
          <div className="h-3 w-full rounded bg-slate-700/40" />
          <div className="h-3 w-2/3 rounded bg-slate-700/30" />
        </div>
      </div>
      <div className="mt-4 h-3 w-20 rounded bg-slate-700/40" />
    </div>
  );
}
