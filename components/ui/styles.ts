/** Shared class strings so new pages match the existing dark ink + indigo look. */
export const ui = {
  card: "rounded-2xl border border-white/10 bg-ink-900/70 p-5 shadow-card backdrop-blur sm:p-6",
  cardMuted: "rounded-2xl border border-white/10 bg-ink-800/50 p-5",
  input:
    "h-12 w-full rounded-xl border border-white/10 bg-ink-800/80 px-4 text-base text-white outline-none placeholder:text-slate-500 transition focus:border-accent/60 focus:ring-2 focus:ring-accent/40",
  textarea:
    "w-full rounded-xl border border-white/10 bg-ink-800/80 px-4 py-3 text-base text-white outline-none placeholder:text-slate-500 transition focus:border-accent/60 focus:ring-2 focus:ring-accent/40",
  label: "mb-1.5 block text-sm font-medium text-slate-300",
  primary:
    "inline-flex h-12 items-center justify-center rounded-xl bg-gradient-to-r from-accent to-accent-glow px-5 text-sm font-semibold text-white shadow-glow transition hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/70 disabled:cursor-not-allowed disabled:opacity-50",
  secondary:
    "inline-flex h-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 text-sm font-medium text-slate-200 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50",
  danger:
    "inline-flex h-9 items-center justify-center rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400",
  link: "font-medium text-accent-soft hover:text-white",
  h1: "text-balance text-3xl font-semibold tracking-tight text-white sm:text-4xl",
  sub: "mt-2 text-balance text-sm leading-relaxed text-slate-400 sm:text-base",
  errorBox: "rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200",
  okBox: "rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200",
  // Neutral indigo note (amber is reserved for the "Couldn't verify" status).
  noteBox: "rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-slate-200",
  proBadge: "rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent-soft ring-1 ring-accent/40",
};
