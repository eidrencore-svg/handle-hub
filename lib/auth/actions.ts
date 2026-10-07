"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/ssr";
import { safeNext, siteOrigin } from "@/lib/site";

export type AuthState = { error?: string; message?: string; email?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials")) return "That email and password don't match.";
  if (m.includes("email not confirmed")) return "Confirm your email first. Check your inbox for the link.";
  if (m.includes("already registered") || m.includes("already been registered")) return "That email already has an account. Log in instead.";
  if (m.includes("rate limit") || m.includes("too many") || m.includes("security purposes"))
    return "Too many attempts. Wait a minute and try again.";
  if (m.includes("not authorized") || m.includes("email address") && m.includes("invalid"))
    return "We couldn't send email to that address. Try another one.";
  if (m.includes("password")) return message;
  return "Something went wrong. Try again in a moment.";
}

function fields(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    password: String(formData.get("password") ?? ""),
    next: safeNext(String(formData.get("next") ?? "") || null),
  };
}

async function client() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) throw new Error("Accounts aren't configured on this server (missing Supabase env).");
  return supabase;
}

export async function signInWithPassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { email, password, next } = fields(formData);
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email.", email };
  if (!password) return { error: "Enter your password.", email };
  let supabase;
  try {
    supabase = await client();
  } catch (e) {
    return { error: (e as Error).message, email };
  }
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: friendly(error.message), email };
  revalidatePath("/", "layout");
  redirect(next);
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { email, password, next } = fields(formData);
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email.", email };
  if (password.length < MIN_PASSWORD) return { error: `Use at least ${MIN_PASSWORD} characters for your password.`, email };
  let supabase;
  try {
    supabase = await client();
  } catch (e) {
    return { error: (e as Error).message, email };
  }
  const origin = await siteOrigin();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) return { error: friendly(error.message), email };
  if (data.session) {
    revalidatePath("/", "layout");
    redirect(next);
  }
  // Supabase returns a user with no identities when the email is already registered (no email is sent).
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return { error: "That email already has an account. Log in instead.", email };
  }
  return { message: `Check ${email} for a confirmation link to finish signing up.`, email };
}

export async function sendMagicLink(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { email, next } = fields(formData);
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email.", email };
  let supabase;
  try {
    supabase = await client();
  } catch (e) {
    return { error: (e as Error).message, email };
  }
  const origin = await siteOrigin();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    // Magic links only log in existing accounts; sign-up goes through /signup.
    options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`, shouldCreateUser: false },
  });
  if (error && !/signups not allowed|user not found/i.test(error.message)) return { error: friendly(error.message), email };
  // Same message whether or not the account exists (no account enumeration).
  return { message: `If ${email} has an account, a login link is on its way. Open it on this device.`, email };
}

export async function sendPasswordReset(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { email } = fields(formData);
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email.", email };
  let supabase;
  try {
    supabase = await client();
  } catch (e) {
    return { error: (e as Error).message, email };
  }
  const origin = await siteOrigin();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/account/reset-password")}`,
  });
  if (error && /rate limit|security purposes/i.test(error.message)) return { error: friendly(error.message), email };
  return { message: `If ${email} has an account, a reset link is on its way. Open it on this device.`, email };
}

export async function updatePassword(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < MIN_PASSWORD) return { error: `Use at least ${MIN_PASSWORD} characters.` };
  if (password !== confirm) return { error: "The two passwords don't match." };
  let supabase;
  try {
    supabase = await client();
  } catch (e) {
    return { error: (e as Error).message };
  }
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "Your reset link expired. Request a new one." };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: friendly(error.message) };
  return { message: "Password updated. You're signed in." };
}
