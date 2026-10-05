import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let serviceClient: SupabaseClient | null | undefined;
let anonClient: SupabaseClient | null | undefined;

function publicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  return { url, anon };
}

/** Service-role client for server writes. Null when key/url missing. */
export function getServiceSupabase(): SupabaseClient | null {
  if (serviceClient !== undefined) return serviceClient;
  const { url } = publicEnv();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    serviceClient = null;
    return null;
  }
  serviceClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return serviceClient;
}

/** Anon client for public reads (recent searches strip). Null when env missing. */
export function getAnonSupabase(): SupabaseClient | null {
  if (anonClient !== undefined) return anonClient;
  const { url, anon } = publicEnv();
  if (!url || !anon) {
    anonClient = null;
    return null;
  }
  anonClient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return anonClient;
}

export const CACHE_TTL_MS = 10 * 60 * 1000;
