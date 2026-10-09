import { getCurrentUser } from "@/lib/supabase/ssr";
import { AccountMenu } from "@/components/AccountMenu";
import { getAccountPlan } from "@/lib/usage";

export async function SiteHeader({ plan }: { plan?: string } = {}) {
  const user = await getCurrentUser();
  const planId = user ? (plan ?? (await getAccountPlan(user.id, user.email))) : undefined;
  return (
    <header className="relative z-40 mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-5 sm:px-6 sm:py-6">
      <a href="/" className="flex shrink-0 items-center gap-2.5" aria-label="Handle Hub home">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent-glow shadow-glow">
          <span className="text-sm font-bold text-white">H</span>
        </div>
        <span className="hidden text-sm font-semibold tracking-wide text-slate-200 min-[380px]:inline">Handle Hub</span>
      </a>
      <nav className="flex items-center gap-1 sm:gap-2" aria-label="Main">
        <a href="/tools" className="rounded-full px-2.5 py-1.5 text-sm text-slate-300 transition hover:text-white">
          Tools
        </a>
        <a href="/pricing" className="rounded-full px-2.5 py-1.5 text-sm text-slate-300 transition hover:text-white">
          Pricing
        </a>
        <a href="/docs/api" className="hidden rounded-full px-2.5 py-1.5 text-sm text-slate-300 transition hover:text-white sm:inline">
          API
        </a>
        {user ? (
          <div className="ml-1">
            <AccountMenu email={user.email} plan={planId} />
          </div>
        ) : (
          <>
            <a href="/login" className="rounded-full px-2.5 py-1.5 text-sm font-medium text-white transition hover:text-accent-soft">
              Log in
            </a>
            <a
              href="/signup"
              className="hidden rounded-full bg-gradient-to-r from-accent to-accent-glow px-3.5 py-1.5 text-sm font-semibold text-white shadow-glow transition hover:brightness-110 sm:inline"
            >
              Sign up
            </a>
          </>
        )}
      </nav>
    </header>
  );
}
