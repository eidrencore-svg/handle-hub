import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/ssr";
import { requestOrigin, safeNext } from "@/lib/site";

export const dynamic = "force-dynamic";

/**
 * Landing point for every auth email (confirm sign-up, magic link, password reset).
 * Handles both the PKCE `?code=` redirect and the `?token_hash=&type=` template style.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNext(url.searchParams.get("next"));
  const base = requestOrigin(request);
  const fail = (msg: string) => NextResponse.redirect(`${base}/login?error=${encodeURIComponent(msg)}`);

  const upstreamError = url.searchParams.get("error_description") || url.searchParams.get("error");
  if (upstreamError) return fail(upstreamError);

  const supabase = await createSupabaseServerClient();
  if (!supabase) return fail("Accounts aren't configured on this server.");

  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail("That link expired or was opened on a different device. Request a new one.");
    return NextResponse.redirect(`${base}${next}`);
  }
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) return fail("That link expired. Request a new one.");
    return NextResponse.redirect(`${base}${type === "recovery" ? "/account/reset-password" : next}`);
  }
  return fail("That link is missing its sign-in code.");
}
