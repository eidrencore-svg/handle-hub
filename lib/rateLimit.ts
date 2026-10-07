type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Simple in-memory per-IP rate limit. Returns true if allowed. */
export function allowRequest(
  key: string,
  limit = 30,
  windowMs = 60_000
): boolean {
  const now = Date.now();
  const cur = buckets.get(key);
  if (!cur || now >= cur.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (cur.count >= limit) return false;
  cur.count += 1;
  return true;
}

export function clientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}

/** Fixed-window limiter that also reports what's left (for X-RateLimit headers). */
export function takeToken(key: string, limit: number, windowMs = 60_000): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  let cur = buckets.get(key);
  if (!cur || now >= cur.resetAt) {
    cur = { count: 0, resetAt: now + windowMs };
    buckets.set(key, cur);
  }
  if (cur.count >= limit) return { allowed: false, remaining: 0, resetAt: cur.resetAt };
  cur.count += 1;
  return { allowed: true, remaining: Math.max(0, limit - cur.count), resetAt: cur.resetAt };
}
