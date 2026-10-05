# Handle Hub

SaaS platform for checking username availability across gaming platforms and social networks, plus social profile information.

## What it does

- Search a handle once and see availability across gaming and social platforms
- Pull public profile metadata where platforms allow it
- Built as a multi-tenant SaaS foundation (auth, API, dashboard)

## Stack (starter)

- **Next.js** (App Router) + TypeScript
- **API routes** for username checks (`GET /api/check?username=`)
- Extensible platform adapters under `lib/platforms/`

## Getting started

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

See `.env.example`. Keys are optional per platform:

| Variable | Used by | Purpose |
| --- | --- | --- |
| `STEAM_API_KEY` | Steam | Official `ResolveVanityURL` (falls back to community XML) |
| `XBOX_AUTHORIZATION` + `XBOX_RESERVATION_ID` | Xbox | True gamertag reservation check |
| `OPENXBL_API_KEY` | Xbox | Profile search via [OpenXBL](https://xbl.io) when reservation creds are missing |
| `X_BEARER_TOKEN` (or `TWITTER_BEARER_TOKEN`) | X | Official user-by-username lookup |
| `INSTAGRAM_APP_ID` | Instagram | Optional App-ID override for the public web_profile_info probe |
| `TWITCH_CLIENT_ID` + `TWITCH_CLIENT_SECRET` | Twitch | Helix `users?login=` via client-credentials app token |
| `YOUTUBE_API_KEY` | YouTube | Data API `channels.list` `forHandle` |

When a required secret is missing for a key-gated path, adapters return `unknown` with a clear `meta.note` — they never invent `available`/`taken`.

## Platform coverage

| Platform | Real available/taken without secrets? | With optional secrets | Notes / limitations |
| --- | --- | --- | --- |
| **Steam** | Yes (vanity URL via community XML) | `STEAM_API_KEY` → ResolveVanityURL | Checks **custom profile URL**, not display persona names (personas are not unique). |
| **Xbox** | No | Reservation tokens → true availability; `OPENXBL_API_KEY` → profile search | Without env vars returns `unknown`. OpenXBL match = taken; no match is treated as available but is not a reservation guarantee. |
| **PlayStation** | Yes | — | Uses Sony’s public `onlineIds` availability endpoint. Undocumented; may change or rate-limit. |
| **Twitch** | Best-effort (public GQL user lookup) | `TWITCH_CLIENT_ID` + `TWITCH_CLIENT_SECRET` → Helix | Prefer Helix for production. GQL uses Twitch’s public web Client-Id. |
| **X (Twitter)** | Best-effort (`x.com` 200/404) | `X_BEARER_TOKEN` → API v2 | HTML probe can false-positive/negative under bot walls. Suspended/reserved handles may look free. |
| **Instagram** | Best-effort (`web_profile_info`) | optional `INSTAGRAM_APP_ID` | Frequently rate-limits / login-walls → `unknown`. Do not treat as ToS-proof production scraping. |
| **TikTok** | Best-effort (oEmbed creator lookup) | — | oEmbed miss ≈ available; reserved names may still fail at signup. |
| **Discord** | Yes (`username-attempt-unauthed`) | — | Signup availability endpoint; aggressive rate limits → `unknown`. |
| **Reddit** | Yes when reachable (`/user/.../about.json`, `username_available`) | — | Datacenter IPs are often blocked; returns `unknown` with a note when challenged. |
| **YouTube** | Best-effort (`/@handle` 200/404) | `YOUTUBE_API_KEY` → `forHandle` | Prefer Data API for accuracy. |

Statuses returned by adapters: `available` | `taken` | `invalid` | `unknown`.

All HTTP probes use an **8s** timeout; network/abort errors become `unknown`.

## API

```http
GET /api/check?username=example
```

Response shape:

```json
{
  "username": "example",
  "results": [
    {
      "platformId": "steam",
      "platformName": "Steam",
      "kind": "gaming",
      "status": "taken",
      "profileUrl": "https://steamcommunity.com/id/example",
      "meta": { "method": "community_xml" }
    }
  ]
}
```

## Project layout

```
lib/platforms/
  types.ts          # shared types
  http.ts           # fetchWithTimeout helper
  steam.ts … youtube.ts
  index.ts          # adapter registry + checkAllPlatforms
app/api/check/route.ts
app/page.tsx
```

## Status

Scaffold with modular real-check adapters. Auth, billing, and multi-tenant dashboard still to come.
