import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { AuthCard } from "@/components/AuthCard";
import { AuthForm } from "@/components/AuthForm";
import { getCurrentUser } from "@/lib/supabase/ssr";
import { safeNext } from "@/lib/site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Create your account · Handle Hub" };

const PERKS = ["The 10 core platforms", "A few full scans a day", "Search history", "Try bulk check and suggestions"];

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (await getCurrentUser()) redirect(next);

  return (
    <PageShell>
      <AuthCard
        title="Claim your name before someone else does."
        subtitle="Free account. No card needed."
        footer={
          <>
            Already have an account?{" "}
            <a href={`/login${sp.next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-accent-soft hover:text-white">
              Log in
            </a>
          </>
        }
      >
        <ul className="mb-5 grid grid-cols-2 gap-2 text-xs text-slate-300">
          {PERKS.map((p) => (
            <li key={p} className="flex items-start gap-1.5">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
              {p}
            </li>
          ))}
        </ul>
        <AuthForm mode="signup" next={next} />
        <p className="mt-4 text-center text-xs text-slate-500">
          By creating an account you agree to use Handle Hub fairly. Results are based on public signals.
        </p>
      </AuthCard>
    </PageShell>
  );
}
