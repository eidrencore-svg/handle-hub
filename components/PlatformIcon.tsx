import type { CSSProperties, SVGProps } from "react";
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

/**
 * Brand glyphs tuned for the dark UI. `glyph` is the colour drawn on the tile
 * and is checked to be ≥ 4.5:1 against the tinted tile (normal and hover card
 * backgrounds). Brands whose own colour is black/very dark (X, TikTok, Steam,
 * PlayStation) are drawn white on a tile tinted with their accent colour.
 */
type IconDef = { path: string; glyph: string; tint: string; accent?: "tiktok" };

const XBOX_PATH =
  "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16zM8.2 7.2 12 11l3.8-3.8 1.4 1.4-3.8 3.8 3.8 3.8-1.4 1.4-3.8-3.8-3.8 3.8-1.4-1.4 3.8-3.8-3.8-3.8z";

export const ICONS: Record<string, IconDef> = {
  steam: { path: siSteam.path, glyph: "#FFFFFF", tint: "#66C0F4" },
  xbox: { path: XBOX_PATH, glyph: "#5DC24C", tint: "#107C10" },
  playstation: { path: siPlaystation.path, glyph: "#FFFFFF", tint: "#0070D1" },
  twitch: { path: siTwitch.path, glyph: "#B58AFF", tint: "#9146FF" },
  twitter: { path: siX.path, glyph: "#FFFFFF", tint: "#E7E9EA" },
  instagram: { path: siInstagram.path, glyph: "#FF5C9D", tint: "#FF0069" },
  tiktok: { path: siTiktok.path, glyph: "#FFFFFF", tint: "#25F4EE", accent: "tiktok" },
  discord: { path: siDiscord.path, glyph: "#959DF8", tint: "#5865F2" },
  reddit: { path: siReddit.path, glyph: "#FF6A33", tint: "#FF4500" },
  youtube: { path: siYoutube.path, glyph: "#FF4D4D", tint: "#FF0000" },
};

function rgba(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

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
        className={`inline-flex items-center justify-center rounded-md bg-white/10 text-[10px] font-bold text-slate-200 ${className}`}
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
      {icon.accent === "tiktok" ? (
        <>
          <path fill="#25F4EE" d={icon.path} transform="translate(-0.9 -0.7)" />
          <path fill="#FE2C55" d={icon.path} transform="translate(0.9 0.7)" />
        </>
      ) : null}
      <path fill={icon.glyph} d={icon.path} />
    </svg>
  );
}

/** Brand glyph on a subtle brand-tinted tile. */
export function PlatformTile({
  platformId,
  title,
  size = "md",
}: {
  platformId: string;
  title?: string;
  size?: "sm" | "md";
}) {
  const icon = ICONS[platformId];
  const style: CSSProperties | undefined = icon
    ? { backgroundColor: rgba(icon.tint, 0.16), boxShadow: `inset 0 0 0 1px ${rgba(icon.tint, 0.38)}` }
    : undefined;
  const box = size === "sm" ? "h-8 w-8 rounded-lg" : "h-10 w-10 rounded-xl";
  const glyph = size === "sm" ? "h-4 w-4" : "h-[22px] w-[22px]";
  return (
    <div className={`flex shrink-0 items-center justify-center ${box} ${icon ? "" : "bg-white/10"}`} style={style}>
      <PlatformIcon platformId={platformId} className={glyph} title={title} />
    </div>
  );
}

/** Deterministic initial tile for catalog sites (light text on a tinted tile, ≥ 6.9:1 for every hue). */
export function SiteInitialTile({ name }: { name: string }) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  const letter = (name.match(/[A-Za-z0-9]/)?.[0] ?? "?").toUpperCase();
  return (
    <div
      aria-hidden
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold"
      style={{ backgroundColor: `hsl(${h} 70% 55% / 0.16)`, boxShadow: `inset 0 0 0 1px hsl(${h} 70% 60% / 0.35)`, color: `hsl(${h} 90% 80%)` }}
    >
      {letter}
    </div>
  );
}
