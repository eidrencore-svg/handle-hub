import type { ProbeResult, SiteDef, SiteStatus } from "./types";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36";
const MAX_BODY_BYTES = 1_500_000;

const regexCache = new Map<string, RegExp | null>();
function compile(re: string): RegExp | null {
  if (regexCache.has(re)) return regexCache.get(re)!;
  let out: RegExp | null = null;
  try {
    out = new RegExp(re, "u");
  } catch {
    try {
      out = new RegExp(re);
    } catch {
      out = null; // Python-only syntax: skip the pre-check
    }
  }
  regexCache.set(re, out);
  return out;
}

export function fill(template: string, username: string, encode = true): string {
  return template.replace(/\{u\}/g, encode ? encodeURIComponent(username) : username);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Bot walls / WAF interstitials: never treat as an answer. */
export function isChallenge(status: number, body: string): boolean {
  const head = body.slice(0, 20_000).toLowerCase();
  if (/<title>\s*just a moment\.\.\.\s*<\/title>|cf-browser-verification|cf_chl_opt|<title>attention required! \| cloudflare|ddos-guard|px-captcha|_incapsula_resource|captcha-delivery\.com|perimeterx/.test(head)) {
    return true;
  }
  if ((status === 403 || status === 429 || status === 503) && /captcha|challenge|access denied|request blocked|bot detection|cloudflare/.test(head)) {
    return true;
  }
  return false;
}

async function readCapped(res: Response): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (total < MAX_BODY_BYTES) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.byteLength;
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  const buf = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    buf.set(c.subarray(0, Math.min(c.byteLength, total - off)), off);
    off += c.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: false }).decode(buf);
}

const some = (markers: string[] | undefined, body: string) =>
  Boolean(markers?.length) && markers!.some((m) => m && body.includes(m));

/**
 * Strict decision table. Anything ambiguous → unknown; availability is only
 * reported when the definition's explicit "missing" signal is observed.
 */
export function decide(
  def: SiteDef,
  status: number,
  body: string,
  location?: string | null
): { status: SiteStatus; reason: string } {
  if (some(def.errorMarkers, body)) return { status: "unknown", reason: "site_error" };
  if (isChallenge(status, body)) return { status: "unknown", reason: "blocked" };
  const is2xx = status >= 200 && status < 300;
  const is3xx = status >= 300 && status < 400;

  switch (def.mode) {
    case "wmn": {
      const eCodes = def.existsCodes ?? [200];
      const mCodes = def.missingCodes ?? [404];
      const existsHit =
        eCodes.includes(status) && (def.existsMarkers?.length ? some(def.existsMarkers, body) : true);
      let missingHit = false;
      if (mCodes.includes(status)) {
        if (def.missingMarkers?.length) missingHit = some(def.missingMarkers, body);
        // Code-only "missing" is trusted only when it can't collide with the exists code.
        else missingHit = !eCodes.includes(status);
      }
      if (existsHit && !missingHit) return { status: "taken", reason: "marker" };
      if (missingHit && !existsHit) return { status: "available", reason: "marker" };
      return { status: "unknown", reason: existsHit ? "conflict" : `http_${status}` };
    }
    case "status": {
      const missing = def.missingCodes?.length ? def.missingCodes : [404, 410];
      if (missing.includes(status)) return { status: "available", reason: `http_${status}` };
      if (is2xx) {
        if (some(def.missingMarkers, body)) return { status: "available", reason: "absence_marker" };
        if (def.existsMarkers?.length && !some(def.existsMarkers, body))
          return { status: "unknown", reason: "no_presence_marker" };
        return { status: "taken", reason: `http_${status}` };
      }
      return { status: "unknown", reason: `http_${status}` };
    }
    case "message": {
      if (status === 429 || status >= 500 || (status === 403 && !def.ignore403))
        return { status: "unknown", reason: `http_${status}` };
      const absence = some(def.missingMarkers, body);
      const presence = def.existsMarkers?.length ? some(def.existsMarkers, body) : null;
      if (absence && presence !== true) return { status: "available", reason: "absence_marker" };
      if (!absence && (presence === true || (presence === null && is2xx)))
        return { status: "taken", reason: presence ? "presence_marker" : `http_${status}` };
      return { status: "unknown", reason: absence ? "conflict" : "no_marker" };
    }
    case "redirect": {
      if (is2xx) {
        if (def.existsMarkers?.length && !some(def.existsMarkers, body))
          return { status: "unknown", reason: "no_presence_marker" };
        return { status: "taken", reason: `http_${status}` };
      }
      if (is3xx && location) return { status: "available", reason: "redirect" };
      if (status === 404 || status === 410) return { status: "available", reason: `http_${status}` };
      return { status: "unknown", reason: `http_${status}` };
    }
  }
}

export interface ProbeOptions {
  timeoutMs?: number;
  retries?: number;
  /** Absolute deadline (epoch ms); no retry after it. */
  deadline?: number;
}

export async function probeSite(
  def: SiteDef,
  rawUsername: string,
  opts: ProbeOptions = {}
): Promise<ProbeResult> {
  const t0 = Date.now();
  const timeoutMs = opts.timeoutMs ?? 8_000;
  let username = rawUsername;
  if (def.stripBadChar) {
    for (const ch of def.stripBadChar) username = username.split(ch).join("");
  }
  const base = { site: def.site, defId: def.id, profileUrl: fill(def.urlTemplate, username) };

  if (def.regexCheck) {
    const re = compile(def.regexCheck);
    if (re && !re.test(username)) {
      return { ...base, status: "invalid", latencyMs: 0, reason: "regex" };
    }
  }

  const url = fill(def.probeUrl, username);
  const headers: Record<string, string> = {
    "User-Agent": UA,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7",
    "Accept-Language": "en-US,en;q=0.9",
    ...(def.headers ?? {}),
  };

  let attempt = 0;
  const retries = opts.retries ?? 1;
  while (true) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: def.method,
        headers,
        body: def.method === "POST" && def.body ? fill(def.body, username, false) : undefined,
        redirect: def.followRedirects ? "follow" : "manual",
        signal: controller.signal,
        cache: "no-store",
      });
      const body = def.method === "HEAD" ? "" : await readCapped(res);
      clearTimeout(timer);
      const retryable = res.status === 429 || res.status === 502 || res.status === 503 || res.status === 504;
      const canRetry = attempt < retries && (!opts.deadline || Date.now() + 2_500 < opts.deadline);
      if (retryable && canRetry) {
        attempt++;
        await sleep(700 + Math.random() * 800);
        continue;
      }
      const d = decide(def, res.status, body, res.headers.get("location"));
      return { ...base, status: d.status, reason: d.reason, httpStatus: res.status, latencyMs: Date.now() - t0 };
    } catch (err) {
      clearTimeout(timer);
      const aborted = err instanceof Error && err.name === "AbortError";
      return { ...base, status: "unknown", reason: aborted ? "timeout" : "network_error", latencyMs: Date.now() - t0 };
    }
  }
}
