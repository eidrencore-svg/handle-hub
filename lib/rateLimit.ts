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
