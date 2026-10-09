import { SiteHeader } from "@/components/SiteHeader";

export function SiteFooter() {
  return (
    <footer className="relative z-10 border-t border-white/5 px-4 py-8 text-center text-xs text-slate-500">
      Handle Hub · availability probes never invent results ·{" "}
      <a href="/tools" className="hover:text-slate-300">Tools</a> · <a href="/pricing" className="hover:text-slate-300">Pricing</a> ·{" "}
      <a href="/docs/api" className="hover:text-slate-300">API</a> · <a href="/status" className="hover:text-slate-300">Platform health</a> · catalog data:
      WhatsMyName (CC BY-SA 4.0), Sherlock &amp; Maigret (MIT)
    </footer>
  );
}

/** Background glow + header + centered main column used by every non-home page. */
export function PageShell({
  children,
  width = "max-w-5xl",
  plan,
}: {
  children: React.ReactNode;
  width?: string;
  plan?: string;
}) {
  return (
    <div className="relative min-h-screen overflow-x-clip">
      <div className="pointer-events-none absolute inset-0 bg-hero-radial" />
      <div className="pointer-events-none absolute -left-24 top-40 h-72 w-72 rounded-full bg-accent/15 blur-3xl" />
      <SiteHeader plan={plan} />
      <main className={`relative z-10 mx-auto ${width} px-4 pb-20 pt-4 sm:px-6 sm:pt-8`}>{children}</main>
      <SiteFooter />
    </div>
  );
}
