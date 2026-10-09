/**
 * API keys: `hh_` + 43 base62 chars. Only the SHA-256 hash is stored;
 * the full key is shown to the user exactly once.
 */
import { createHash, randomBytes } from "node:crypto";
import { getServiceSupabase } from "@/lib/supabase/server";
import { getAccountPlan } from "@/lib/usage";
import type { PlanId } from "@/lib/plans";

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
export const KEY_PREFIX = "hh_";
const PREFIX_LEN = KEY_PREFIX.length + 8;

export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const bytes = randomBytes(43);
  let body = "";
  for (const b of bytes) body += ALPHABET[b % 62]; // 43 chars ≈ 256 bits of entropy
  const key = `${KEY_PREFIX}${body}`;
  return { key, prefix: key.slice(0, PREFIX_LEN), hash: hashApiKey(key) };
}

export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function extractApiKey(headers: Headers): string | null {
  const auth = headers.get("authorization");
  const m = auth?.match(/^Bearer\s+(\S+)$/i);
  const key = m?.[1] ?? headers.get("x-api-key")?.trim() ?? null;
  return key && key.startsWith(KEY_PREFIX) && key.length >= 20 && key.length <= 100 ? key : null;
}

const lastTouched = new Map<string, number>();

export type ApiCaller = { keyId: string; userId: string; plan: PlanId };

/** Look up an active key by hash. Returns null for unknown or revoked keys. */
export async function authenticateApiKey(key: string): Promise<ApiCaller | null> {
  const sb = getServiceSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from("api_keys")
    .select("id, user_id, revoked_at")
    .eq("key_hash", hashApiKey(key))
    .maybeSingle();
  if (error || !data || data.revoked_at) return null;
  const now = Date.now();
  if ((lastTouched.get(data.id) ?? 0) < now - 60_000) {
    lastTouched.set(data.id, now);
    void sb.from("api_keys").update({ last_used_at: new Date(now).toISOString() }).eq("id", data.id).then(() => undefined);
  }
  return { keyId: data.id, userId: data.user_id, plan: await getAccountPlan(data.user_id) };
}
