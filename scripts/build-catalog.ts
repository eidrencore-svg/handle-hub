/**
 * Build data/sites/catalog.generated.json from pinned WhatsMyName (CC BY-SA 4.0),
 * Sherlock (MIT) and Maigret (MIT) data. The generated file keeps per-entry
 * source + license and is not committed (see THIRD_PARTY.md).
 *
 *   npm run catalog            # download (cached in data/upstream/) + normalize
 *   npm run catalog -- --if-missing
 */
import fs from "node:fs";
import path from "node:path";
import { UPSTREAM, rawUrl, type UpstreamKey } from "../lib/engine/upstream";
import type { CatalogFile, SiteCategory, SiteDef } from "../lib/engine/types";

const ROOT = process.cwd();
const UP_DIR = path.join(ROOT, "data", "upstream");
const OUT = path.join(ROOT, "data", "sites", "catalog.generated.json");

/** Hand-tuned adapters own these platforms (lib/platforms). */
const CORE_HOSTS = [
  "instagram.com", "reddit.com", "discord.com", "x.com", "twitter.com", "tiktok.com",
  "twitch.tv", "youtube.com", "xbox.com", "xboxgamertag.com", "playstation.com",
  "psnprofiles.com", "twitchtracker.com", "imginn.com", "nitter.privacydev.net",
];
const CORE_NAME = /^(instagram|reddit|discord|discord \(user\)|x|twitter|tiktok|twitch|steam|steam community \(user\)|youtube|youtube user2|xbox gamertag|playstation network|psnprofiles\.com)$/i;
const CORE_KEYS = new Set(["steamcommunity.com/id/{u}"]);
const NSFW_TAGS = new Set(["porn", "erotic", "webcam"]);
const SKIP_TAGS = new Set(["tor", "i2p", "archive"]);
const SENSITIVE_HEADER = /^(authorization|cookie|x-guest-token|x-csrf-token|x-ig-www-claim)$/i;

async function loadUpstream(key: UpstreamKey): Promise<unknown> {
  fs.mkdirSync(UP_DIR, { recursive: true });
  const file = path.join(UP_DIR, `${key}-${UPSTREAM[key].sha.slice(0, 12)}.json`);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  const res = await fetch(rawUrl(key), { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`${key}: HTTP ${res.status}`);
  const text = await res.text();
  fs.writeFileSync(file, text);
  return JSON.parse(text);
}

const slug = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "site";

function groupKey(urlTemplate: string): string {
  return urlTemplate
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[/#?]+$/, "")
    .replace(/\/+$/, "");
}

function hostOfTemplate(t: string): string {
  try {
    return new URL(t.replace(/\{u\}/g, "x")).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

const CAT_MAP: Array<[SiteCategory, string[]]> = [
  ["gaming", ["gaming"]],
  ["dev", ["coding", "tech", "hacking"]],
  ["social", ["social", "networking", "messaging", "geosocial", "dating"]],
  ["creative", ["art", "design", "photo", "images", "music", "video", "streaming", "writing", "blog", "3d", "books", "movies", "anime", "sharing"]],
  ["business", ["business", "finance", "crypto", "shopping", "professional", "freelance", "career", "trading", "nft", "fintech", "stock", "classified"]],
  ["community", ["forum", "discussion", "wiki", "q&a", "hobby", "education", "science", "sport", "travel", "auto", "health", "political", "news", "misc", "review", "reading", "cooking", "fashion", "religion"]],
];
function categorize(tags: string[]): SiteCategory {
  const t = tags.map((x) => x.toLowerCase());
  for (const [cat, keys] of CAT_MAP) if (t.some((x) => keys.includes(x))) return cat;
  return "other";
}

const asArr = <T,>(v: T | T[] | undefined | null): T[] =>
  v == null ? [] : Array.isArray(v) ? v : [v];

function cleanHeaders(h: unknown): Record<string, string> | undefined {
  if (!h || typeof h !== "object") return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(h as Record<string, unknown>)) {
    if (SENSITIVE_HEADER.test(k)) return null as unknown as undefined; // needs a token → skip site
    out[k] = String(v);
  }
  return Object.keys(out).length ? out : undefined;
}

function fromWmn(data: { sites: Array<Record<string, any>> }): SiteDef[] {
  const out: SiteDef[] = [];
  for (const s of data.sites) {
    if (s.valid === false || s.cat === "archived") continue;
    const headers = cleanHeaders(s.headers);
    if (headers === (null as unknown)) continue;
    const t = (u: string) => String(u).replace(/\{account\}/g, "{u}");
    out.push({
      id: `wmn:${slug(s.name)}`,
      site: "",
      name: s.name,
      source: "wmn",
      license: "CC-BY-SA-4.0",
      category: categorize([s.cat]),
      tags: [s.cat],
      nsfw: /nsfw/i.test(s.cat),
      urlTemplate: t(s.uri_pretty || s.uri_check),
      probeUrl: t(s.uri_check),
      method: s.post_body ? "POST" : "GET",
      body: s.post_body ? t(s.post_body) : undefined,
      headers,
      mode: "wmn",
      existsCodes: [Number(s.e_code)],
      missingCodes: [Number(s.m_code)],
      existsMarkers: s.e_string ? [s.e_string] : [],
      missingMarkers: s.m_string ? [s.m_string] : [],
      known: asArr<string>(s.known).filter(Boolean),
      stripBadChar: s.strip_bad_char || undefined,
      followRedirects: false,
    });
  }
  return out;
}

function fromSherlock(data: Record<string, any>): SiteDef[] {
  const out: SiteDef[] = [];
  for (const [name, s] of Object.entries(data)) {
    if (!s || typeof s !== "object" || !s.url || name.startsWith("$")) continue;
    const headers = cleanHeaders(s.headers);
    if (headers === (null as unknown)) continue;
    const t = (u: string) => String(u).replace(/\{\}/g, "{u}");
    const mode = s.errorType === "status_code" ? "status" : s.errorType === "response_url" ? "redirect" : "message";
    const method = String(s.request_method || "GET").toUpperCase();
    out.push({
      id: `sherlock:${slug(name)}`,
      site: "",
      name,
      source: "sherlock",
      license: "MIT",
      category: "other",
      nsfw: Boolean(s.isNSFW),
      urlMain: s.urlMain,
      urlTemplate: t(s.url),
      probeUrl: t(s.urlProbe || s.url),
      method: (method === "PUT" ? "POST" : method) as SiteDef["method"],
      body: s.request_payload ? t(JSON.stringify(s.request_payload)) : undefined,
      headers: s.request_payload ? { "Content-Type": "application/json", ...(headers ?? {}) } : headers,
      mode,
      missingCodes: s.errorCode ? asArr<number>(s.errorCode).map(Number) : undefined,
      missingMarkers: mode === "message" ? asArr<string>(s.errorMsg) : undefined,
      errorUrl: s.errorUrl ? t(s.errorUrl) : undefined,
      regexCheck: s.regexCheck,
      known: asArr<string>(s.username_claimed).filter(Boolean),
      followRedirects: mode !== "redirect",
    });
  }
  return out;
}

function fromMaigret(data: { sites: Record<string, any> }): SiteDef[] {
  const out: SiteDef[] = [];
  for (const [name, s] of Object.entries(data.sites)) {
    if (s.disabled || s.engine || s.type || s.activation || s.source) continue;
    const tags: string[] = s.tags ?? [];
    if (tags.some((t) => SKIP_TAGS.has(t))) continue;
    if (!s.url || !s.checkType) continue;
    const headers = cleanHeaders(s.headers);
    if (headers === (null as unknown)) continue;
    const main = String(s.urlMain || "").replace(/\/$/, "");
    const t = (u: string) =>
      String(u)
        .replace(/\{urlMain\}/g, main)
        .replace(/\{urlSubpath\}/g, s.urlSubpath || "")
        .replace(/\{username\}/g, "{u}");
    if (/\{\{|\{[a-z]+\}/i.test(t(s.url).replace(/\{u\}/g, ""))) continue;
    const mode = s.checkType === "status_code" ? "status" : s.checkType === "response_url" ? "redirect" : "message";
    const method = String(s.requestMethod || "GET").toUpperCase();
    out.push({
      id: `maigret:${slug(name)}`,
      site: "",
      name,
      source: "maigret",
      license: "MIT",
      category: categorize(tags),
      tags: tags.filter((x) => x.length > 2),
      nsfw: tags.some((x) => NSFW_TAGS.has(x)),
      urlMain: s.urlMain,
      urlTemplate: t(s.url),
      probeUrl: t(s.urlProbe || s.url),
      method: (method === "PUT" ? "POST" : method) as SiteDef["method"],
      body: s.requestPayload ? t(JSON.stringify(s.requestPayload)) : undefined,
      headers: s.requestPayload ? { "Content-Type": "application/json", ...(headers ?? {}) } : headers,
      mode,
      existsMarkers: mode === "message" ? asArr<string>(s.presenseStrs) : undefined,
      missingMarkers: mode === "message" ? asArr<string>(s.absenceStrs) : undefined,
      errorMarkers: s.errors ? Object.keys(s.errors) : undefined,
      errorUrl: s.errorUrl ? t(s.errorUrl) : undefined,
      regexCheck: s.regexCheck,
      known: asArr<string>(s.usernameClaimed).filter(Boolean),
      unclaimed: s.usernameUnclaimed,
      ignore403: Boolean(s.ignore403),
      followRedirects: mode !== "redirect",
    });
  }
  return out;
}

export async function buildCatalog(): Promise<CatalogFile> {
  const [wmn, sherlock, maigret] = await Promise.all([
    loadUpstream("wmn"),
    loadUpstream("sherlock"),
    loadUpstream("maigret"),
  ]);
  // Priority inside a site group: WMN (two-sided markers) > Maigret > Sherlock.
  const all = [
    ...fromWmn(wmn as never),
    ...fromMaigret(maigret as never),
    ...fromSherlock(sherlock as never),
  ];

  const groups = new Map<string, SiteDef[]>();
  for (const d of all) {
    if (!/^https?:\/\//.test(d.probeUrl) || !d.probeUrl.includes("{u}") && !d.body?.includes("{u}")) continue;
    if (!d.known.length) continue;
    const host = hostOfTemplate(d.urlTemplate);
    const probeHost = hostOfTemplate(d.probeUrl);
    const key = groupKey(d.urlTemplate);
    if (CORE_NAME.test(d.name) || CORE_KEYS.has(key)) continue;
    if (CORE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`) || probeHost === h || probeHost.endsWith(`.${h}`))) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(d);
  }

  const usedSlugs = new Set(["steam", "xbox", "playstation", "twitch", "twitter", "instagram", "tiktok", "discord", "reddit", "youtube"]);
  const defs: SiteDef[] = [];
  const seenIds = new Set<string>();
  for (const [key, members] of groups) {
    const lead = members[0];
    let s = slug(lead.name);
    if (usedSlugs.has(s)) s = slug(`${lead.name}-${hostOfTemplate(lead.urlTemplate)}`);
    let n = 2;
    while (usedSlugs.has(s)) s = `${slug(lead.name)}-${n++}`;
    usedSlugs.add(s);
    // Category/tags: prefer any member with a real category.
    const cat = members.find((m) => m.category !== "other")?.category ?? "other";
    const nsfw = members.some((m) => m.nsfw);
    for (const m of members) {
      let id = m.id;
      let k = 2;
      while (seenIds.has(id)) id = `${m.id}-${k++}`;
      seenIds.add(id);
      defs.push({ ...m, id, site: s, category: cat, nsfw, name: lead.name, urlMain: m.urlMain || lead.urlMain || `https://${hostOfTemplate(lead.urlTemplate)}` });
    }
    void key;
  }

  return {
    generatedAt: new Date().toISOString(),
    upstream: {
      wmn: { repo: UPSTREAM.wmn.repo, sha: UPSTREAM.wmn.sha, license: UPSTREAM.wmn.license },
      sherlock: { repo: UPSTREAM.sherlock.repo, sha: UPSTREAM.sherlock.sha, license: UPSTREAM.sherlock.license },
      maigret: { repo: UPSTREAM.maigret.repo, sha: UPSTREAM.maigret.sha, license: UPSTREAM.maigret.license },
    },
    defs,
  };
}

async function main() {
  if (process.argv.includes("--if-missing") && fs.existsSync(OUT)) {
    console.log("[catalog] exists, skipping");
    return;
  }
  try {
    const cat = await buildCatalog();
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(cat));
    const sites = new Set(cat.defs.map((d) => d.site)).size;
    const bySrc = cat.defs.reduce<Record<string, number>>((a, d) => ((a[d.source] = (a[d.source] ?? 0) + 1), a), {});
    console.log(`[catalog] ${cat.defs.length} definitions → ${sites} sites`, bySrc);
  } catch (err) {
    console.warn("[catalog] build failed:", err instanceof Error ? err.message : err);
    if (!fs.existsSync(OUT)) {
      fs.mkdirSync(path.dirname(OUT), { recursive: true });
      fs.writeFileSync(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), upstream: {}, defs: [] }));
      console.warn("[catalog] wrote empty catalog; /api/scan will only report core platforms");
    }
  }
}

if (require.main === module || process.argv[1]?.endsWith("build-catalog.ts")) {
  void main();
}
