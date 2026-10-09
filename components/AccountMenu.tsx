"use client";

import { useEffect, useRef } from "react";
import { ACCOUNT_SECTIONS } from "@/lib/accountNav";

export function AccountMenu({ email, plan }: { email: string | null; plan?: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) ref.current.open = false;
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);
  const initial = (email ?? "?").trim().charAt(0).toUpperCase() || "?";
  return (
    <details ref={ref} className="relative">
      <summary
        aria-label="Account menu"
        className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-glow text-sm font-semibold text-white shadow-glow outline-none ring-white/60 focus-visible:ring-2 [&::-webkit-details-marker]:hidden"
      >
        {initial}
      </summary>
      <div className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-white/10 bg-ink-900/95 shadow-card backdrop-blur">
        <div className="border-b border-white/10 px-4 py-3">
          <p className="truncate text-sm font-medium text-white">{email ?? "Signed in"}</p>
          {plan ? <p className="mt-0.5 text-xs capitalize text-slate-400">{plan} plan</p> : null}
        </div>
        <nav className="py-1">
          {ACCOUNT_SECTIONS.map((l) => (
            <a key={l.href} href={l.href} className="block px-4 py-2.5 text-sm text-slate-300 hover:bg-white/5 hover:text-white">
              {l.label}
            </a>
          ))}
        </nav>
        <form action="/auth/signout" method="post" className="border-t border-white/10">
          <button type="submit" className="block w-full px-4 py-2.5 text-left text-sm text-slate-300 hover:bg-white/5 hover:text-white">
            Log out
          </button>
        </form>
      </div>
    </details>
  );
}
