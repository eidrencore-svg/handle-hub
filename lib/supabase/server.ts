import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

export type DB = SupabaseClient<Database>;

let serviceClient: DB | null | undefined;
let anonClient: DB | null | undefined;

function publicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  return { url, anon };
}

/** Service-role client for server writes. Null when key/url missing. */
export function getServiceSupabase(): DB | null {
  if (serviceClient !== undefined) return serviceClient;
  const { url } = publicEnv();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  serviceClient =
    url && key
      ? createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
      : null;
  return serviceClient;
}

/** Anon client for public reads. Null when env missing. */
export function getAnonSupabase(): DB | null {
  if (anonClient !== undefined) return anonClient;
  const { url, anon } = publicEnv();
  anonClient =
    url && anon
      ? createClient<Database>(url, anon, { auth: { persistSession: false, autoRefreshToken: false } })
      : null;
  return anonClient;
}

/** Core platforms (/api/check) cache TTL. */
export const CACHE_TTL_MS = 10 * 60 * 1000;
/** Catalog sites (/api/scan) cache TTL. */
export const SCAN_CACHE_TTL_MS = 30 * 60 * 1000;
