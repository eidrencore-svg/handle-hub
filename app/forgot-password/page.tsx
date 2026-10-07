import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { AuthCard } from "@/components/AuthCard";
import { AuthForm } from "@/components/AuthForm";

export const metadata: Metadata = { title: "Reset your password · Handle Hub" };

export default function ForgotPasswordPage() {
  return (
    <PageShell>
      <AuthCard
        title="Reset your password"
        subtitle="We'll email you a link to set a new one."
        footer={
          <a href="/login" className="font-medium text-accent-soft hover:text-white">
            Back to log in
          </a>
        }
      >
        <AuthForm mode="forgot" />
      </AuthCard>
    </PageShell>
  );
}
