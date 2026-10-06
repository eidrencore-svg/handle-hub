"use client";

import { useState } from "react";
import { PlatformIcon, PlatformTile } from "@/components/PlatformIcon";
import { kindLabel, statusBadgeClasses } from "@/components/statusStyles";
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

function confidenceLabel(c?: string, estimate?: boolean): string | null {
  if (c === "high") return "High confidence";
  if (c === "medium") return "Medium";
  if (c === "low" && (estimate || true)) return estimate ? "Low / Estimate" : "Low";
  if (estimate) return "Estimate";
  return null;
}

function confidenceClasses(c?: string): string {
  switch (c) {
    case "high":
      return "bg-emerald-500/10 text-emerald-300/90 ring-emerald-500/20";
    case "medium":
      return "bg-sky-500/10 text-sky-300/90 ring-sky-500/20";
    default:
      return "bg-white/5 text-slate-400 ring-white/10";
  }
}

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

const DISCORD_HINT = "Discord has no public profile pages. To confirm, open Discord → Settings → My Account → Username.";

export function PlatformCard({
  result,
  onRetry,
  retrying = false,
}: {
  result: CheckResult;
  onRetry?: () => void;
  retrying?: boolean;
}) {
  const message = result.userMessage;
  const conf = confidenceLabel(result.confidence, result.estimate);
  const showProfile = result.status === "taken" && result.profile;
  const isUnknown = result.status === "unknown";

  return (
    <article
      className={`group relative flex flex-col rounded-2xl border p-4 shadow-card backdrop-blur transition ${
        isUnknown
          ? "border-sky-300/15 bg-ink-800/70 hover:border-sky-300/30"
          : "border-white/10 bg-ink-800/70 hover:border-accent/40 hover:bg-ink-700/80"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <PlatformTile platformId={result.platformId} title={result.platformName} />
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-white">
              {result.platformName}
            </h3>
            <p className="mt-0.5 text-xs uppercase tracking-wide text-slate-400">
              {kindLabel(result.kind)}
              {result.cached ? " · cached" : ""}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${
              isUnknown ? "bg-sky-400/10 text-sky-200 ring-1 ring-sky-300/25" : statusBadgeClasses(result.status)
            }`}
          >
            {isUnknown ? "Not verified" : result.status === "invalid" ? "Not allowed" : result.status}
          </span>
          {conf && !isUnknown && result.status !== "invalid" ? (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ring-1 ${confidenceClasses(result.confidence)}`}
            >
              {conf}
            </span>
          ) : null}
        </div>
      </div>

      {showProfile ? (
        <ProfileBlock
          profile={result.profile!}
          platformId={result.platformId}
          platformName={result.platformName}
        />
      ) : null}

      {isUnknown ? (
        <div className="mt-3 rounded-xl border border-sky-300/10 bg-sky-400/[0.04] p-3">
          <p className="text-xs leading-relaxed text-slate-300">
            {message || "We couldn't get a clear answer automatically."}{" "}
            <span className="text-slate-400">
              {result.checkUrl ? "Confirm it yourself in one tap:" : result.platformId === "discord" ? DISCORD_HINT : ""}
            </span>
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {result.checkUrl ? (
              <a
                href={result.checkUrl}
                target="_blank"
                rel="noreferrer nofollow"
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white ring-1 ring-white/15 transition hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Check on {result.platformName}
                <ExternalIcon />
              </a>
            ) : null}
            {onRetry ? (
              <button
                type="button"
                onClick={onRetry}
                disabled={retrying}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-300 ring-1 ring-white/10 transition hover:bg-white/5 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
              >
                <RetryIcon spinning={retrying} />
                {retrying ? "Retrying…" : "Retry"}
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <>
          <div className="mt-4 flex min-h-[1.25rem] items-center justify-between gap-2">
            {result.status === "taken" && result.profileUrl ? (
              <a
                href={result.profileUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-medium text-accent-soft underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                View profile
              </a>
            ) : (
              <span className="text-sm text-slate-500">—</span>
            )}
          </div>
          {message ? (
            <p className={`mt-3 text-xs leading-relaxed ${result.status === "invalid" ? "text-amber-200/90" : "line-clamp-2 text-slate-400"}`}>
              {message}
            </p>
          ) : null}
        </>
      )}
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
