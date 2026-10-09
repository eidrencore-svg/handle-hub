/** "Use a password instead" / "Email me a link instead" switch under the auth forms. */
export function AuthModeLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <div className="mt-5 flex items-center gap-3 text-xs text-slate-500">
      <span className="h-px flex-1 bg-white/10" aria-hidden />
      <a href={href} className="font-medium text-slate-300 underline-offset-4 hover:text-white hover:underline">
        {children}
      </a>
      <span className="h-px flex-1 bg-white/10" aria-hidden />
    </div>
  );
}
