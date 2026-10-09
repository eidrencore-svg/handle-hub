import { PageShell } from "@/components/PageShell";
import { ACCOUNT_SECTIONS, type AccountSection } from "@/lib/accountNav";

/** Account menu: a scrollable tab bar on phones, a sticky side nav on desktop. */
export function AccountNav({ active }: { active: AccountSection }) {
  return (
    <nav aria-label="Account" className="-mx-4 mb-6 border-b border-white/10 px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:mb-0 lg:border-b-0 lg:px-0">
      <ul className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:sticky lg:top-6 lg:flex-col lg:gap-0.5 lg:overflow-visible">
        {ACCOUNT_SECTIONS.map((s) => {
          const on = s.id === active;
          return (
            <li key={s.id} className="shrink-0">
              <a
                href={s.href}
                aria-current={on ? "page" : undefined}
                className={`block whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:rounded-xl lg:border-b-0 lg:py-2.5 ${
                  on
                    ? "border-accent text-white lg:bg-accent/15 lg:text-white lg:ring-1 lg:ring-accent/30"
                    : "border-transparent text-slate-400 hover:text-white lg:hover:bg-white/5"
                }`}
              >
                {s.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Page shell for every account section (/account/*, plus the watchlist). */
export function AccountLayout({ active, plan, children }: { active: AccountSection; plan?: string; children: React.ReactNode }) {
  return (
    <PageShell width="max-w-5xl" plan={plan}>
      <div className="lg:grid lg:grid-cols-[180px_minmax(0,1fr)] lg:gap-10">
        <AccountNav active={active} />
        <div className="min-w-0">{children}</div>
      </div>
    </PageShell>
  );
}
