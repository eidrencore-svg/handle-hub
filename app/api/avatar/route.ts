import { NextRequest, NextResponse } from "next/server";

/** CDN hosts allowed for avatar proxying (hotlink/CORS safe). */
const ALLOWED_HOST_SUFFIXES = [
  "steamstatic.com",
  "steamcommunity.com",
  "akamaihd.net",
  "jtvnw.net",
  "twitch.tv",
  "googleusercontent.com",
  "ytimg.com",
  "ggpht.com",
  "tiktokcdn.com",
  "tiktokcdn-us.com",
  "tiktokcdn-eu.com",
  "musical.ly",
  "twimg.com",
  "twitter.com",
  "cdninstagram.com",
  "fbcdn.net",
  "instagram.com",
  "redd.it",
  "redditstatic.com",
  "redditmedia.com",
  "snooguts.net",
  "xboxlive.com",
];

function hostAllowed(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return ALLOWED_HOST_SUFFIXES.some(
    (s) => h === s || h.endsWith(`.${s}`)
  );
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("url")?.trim();
  if (!raw) {
    return NextResponse.json({ error: "url required" }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return NextResponse.json({ error: "invalid url" }, { status: 400 });
  }

  if (target.protocol !== "https:" && target.protocol !== "http:") {
    return NextResponse.json({ error: "unsupported protocol" }, { status: 400 });
  }
  if (!hostAllowed(target.hostname)) {
    return NextResponse.json({ error: "host not allowed" }, { status: 403 });
  }

  try {
    const upstream = await fetch(target.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; HandleHub/0.1; +https://github.com/eidrencore-svg/handle-hub)",
        Accept: "image/*,*/*;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(8_000),
    });
    // Redirects must stay on allowlisted CDNs too
    if (upstream.url && !hostAllowed(new URL(upstream.url).hostname)) {
      return NextResponse.json({ error: "redirect host not allowed" }, { status: 403 });
    }
    if (!upstream.ok) {
      return NextResponse.json(
        { error: `upstream ${upstream.status}` },
        { status: 502 }
      );
    }
    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    if (!contentType.startsWith("image/") && !contentType.includes("octet-stream")) {
      return NextResponse.json({ error: "not an image" }, { status: 502 });
    }
    const buf = await upstream.arrayBuffer();
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": contentType.startsWith("image/")
          ? contentType
          : "image/jpeg",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch {
    return NextResponse.json({ error: "fetch failed" }, { status: 502 });
  }
}
