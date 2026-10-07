import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { AuthCard } from "@/components/AuthCard";
import { AuthForm } from "@/components/AuthForm";
import { AuthModeLink } from "@/components/AuthModeLink";
import { getCurrentUser } from "@/lib/supabase/ssr";
import { safeNext } from "@/lib/site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Log in · Handle Hub" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; mode?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (await getCurrentUser()) redirect(next);
  // Email link is the default; ?mode=password switches to the password form.
  const magic = sp.mode !== "password";
  const q = (m?: string) => `/login?${new URLSearchParams({ ...(m ? { mode: m } : {}), ...(sp.next ? { next } : {}) })}`;

  return (
    <PageShell>
      <AuthCard
        title="Welcome back"
        subtitle="Log in to see your history, API keys and watchlist."
        footer={
          <>
            New to Handle Hub?{" "}
            <a href={`/signup${sp.next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-accent-soft hover:text-white">
              Create a free account
            </a>
          </>
        }
      >
        {magic ? <p className="mb-4 text-sm text-slate-400">We&apos;ll email you a link that logs you in. No password needed.</p> : null}
        <AuthForm key={magic ? "magic" : "login"} mode={magic ? "magic" : "login"} next={next} initialError={sp.error} />
        <AuthModeLink href={magic ? q("password") : q()}>{magic ? "Use a password instead" : "Email me a login link instead"}</AuthModeLink>
      </AuthCard>
    </PageShell>
  );
}
