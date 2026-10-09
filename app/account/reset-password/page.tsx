import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { AuthCard } from "@/components/AuthCard";
import { AuthForm } from "@/components/AuthForm";
import { getCurrentUser } from "@/lib/supabase/ssr";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Set a new password · Handle Hub" };

export default async function ResetPasswordPage() {
  if (!(await getCurrentUser())) {
    redirect(`/login?error=${encodeURIComponent("Your reset link expired. Request a new one.")}`);
  }
  return (
    <PageShell>
      <AuthCard title="Set a new password">
        <AuthForm mode="reset" />
      </AuthCard>
    </PageShell>
  );
}
