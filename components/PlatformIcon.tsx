import type { SVGProps } from "react";
import {
  siDiscord,
  siInstagram,
  siPlaystation,
  siReddit,
  siSteam,
  siTiktok,
  siTwitch,
  siX,
  siYoutube,
} from "simple-icons";

type IconDef = { path: string; hex: string };

const XBOX_ICON: IconDef = {
  path: "M7.05 4.5L12 9.45 16.95 4.5 19.5 7.05 14.55 12l4.95 4.95-2.55 2.55L12 14.55l-4.95 4.95L4.5 16.95 9.45 12 4.5 7.05 7.05 4.5z",
  hex: "107C10",
};

const ICONS: Record<string, IconDef> = {
  steam: { path: siSteam.path, hex: siSteam.hex },
  xbox: XBOX_ICON,
  playstation: { path: siPlaystation.path, hex: siPlaystation.hex },
  twitch: { path: siTwitch.path, hex: siTwitch.hex },
  twitter: { path: siX.path, hex: siX.hex },
  instagram: { path: siInstagram.path, hex: siInstagram.hex },
  tiktok: { path: siTiktok.path, hex: siTiktok.hex },
  discord: { path: siDiscord.path, hex: siDiscord.hex },
  reddit: { path: siReddit.path, hex: siReddit.hex },
  youtube: { path: siYoutube.path, hex: siYoutube.hex },
};

export function PlatformIcon({
  platformId,
  className = "h-5 w-5",
  title,
  ...rest
}: {
  platformId: string;
  className?: string;
  title?: string;
} & SVGProps<SVGSVGElement>) {
  const icon = ICONS[platformId];
  if (!icon) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-md bg-white/10 text-[10px] font-bold text-slate-300 ${className}`}
        aria-hidden
      >
        ?
      </span>
    );
  }

  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      className={className}
      aria-hidden={title ? undefined : true}
      {...rest}
    >
      {title ? <title>{title}</title> : null}
      <path fill={`#${icon.hex}`} d={icon.path} />
    </svg>
  );
}
