import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { AuthCard } from "@/components/AuthCard";
import { AuthForm } from "@/components/AuthForm";
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
  const magic = sp.mode === "magic";
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
        <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-ink-800/60 p-1 text-sm" role="tablist">
          <a
            href={q()}
            role="tab"
            aria-selected={!magic}
            className={`rounded-lg px-3 py-2 text-center font-medium transition ${!magic ? "bg-accent text-white shadow-glow" : "text-slate-400 hover:text-white"}`}
          >
            Password
          </a>
          <a
            href={q("magic")}
            role="tab"
            aria-selected={magic}
            className={`rounded-lg px-3 py-2 text-center font-medium transition ${magic ? "bg-accent text-white shadow-glow" : "text-slate-400 hover:text-white"}`}
          >
            Email link
          </a>
        </div>
        <AuthForm key={magic ? "magic" : "login"} mode={magic ? "magic" : "login"} next={next} initialError={sp.error} />
      </AuthCard>
    </PageShell>
  );
}
