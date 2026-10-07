/**
 * Cookie-based Supabase clients for the App Router (@supabase/ssr).
 * Use these for anything that acts as the signed-in user (RLS applies).
 * The service-role client in ./server.ts stays server-only for trusted writes.
 */
import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "./types";
import { supabasePublicEnv } from "./env";

export { supabasePublicEnv };

export function authConfigured(): boolean {
  return supabasePublicEnv() !== null;
}

/** Server Components, Server Actions and Route Handlers. */
export async function createSupabaseServerClient() {
  const env = supabasePublicEnv();
  if (!env) return null;
  const cookieStore = await cookies();
  return createServerClient<Database>(env.url, env.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component: middleware refreshes the session instead.
        }
      },
    },
  });
}

export type SessionUser = { id: string; email: string | null; createdAt: string | null };

/**
 * The verified signed-in user (getUser() asks the Auth server, so a forged
 * cookie can't pass). Cached per request.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    return { id: data.user.id, email: data.user.email ?? null, createdAt: data.user.created_at ?? null };
  } catch {
    return null;
  }
});
