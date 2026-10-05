export const DEFAULT_TIMEOUT_MS = 8_000;

export const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...rest } = init;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...rest,
      signal: controller.signal,
      redirect: rest.redirect ?? "follow",
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Fetch with up to 2 retries on 429/5xx using jittered backoff. */
export async function fetchWithRetry(
  url: string,
  init: RequestInit & { timeoutMs?: number; maxRetries?: number } = {}
): Promise<Response> {
  const maxRetries = init.maxRetries ?? 2;
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const res = await fetchWithTimeout(url, init);
    const retryable = res.status === 429 || res.status >= 500;
    if (!retryable || attempt >= maxRetries) return res;
    const retryAfter = Number(res.headers.get("retry-after"));
    const base = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : 400 * 2 ** attempt;
    const jitter = Math.floor(Math.random() * 250);
    await sleep(Math.min(base + jitter, 4000));
    attempt += 1;
  }
}

export function isAbortError(err: unknown): boolean {
  return (
    (err instanceof Error && err.name === "AbortError") ||
    (typeof DOMException !== "undefined" &&
      err instanceof DOMException &&
      err.name === "AbortError")
  );
}

/** Heuristic: login walls, captchas, challenge pages. */
export function looksLikeChallenge(body: string, status?: number): boolean {
  const b = body.slice(0, 8000).toLowerCase();
  if (status === 403 || status === 429) {
    if (/captcha|challenge|cf-ray|attention required|access denied|just a moment/.test(b)) {
      return true;
    }
  }
  return /captcha|challenge-platform|cf-browser-verification|verify you are human|attention required|login to continue|sign in to continue/.test(
    b
  );
}

export function extractMeta(html: string, prop: string): string | undefined {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`,
    "i"
  );
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`,
    "i"
  );
  return html.match(re)?.[1] ?? html.match(re2)?.[1];
}

export function extractTitle(html: string): string | undefined {
  return html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim();
}
