import { ui } from "@/components/ui/styles";

/** Inline notice for signed-out visitors and features outside the current plan. */
export function Gate({ kind, feature, detail, next }: { kind: "login" | "pro" | "trial"; feature: string; detail?: string; next?: string }) {
  if (kind === "login") {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-accent/30 bg-accent/10 p-4 text-sm text-slate-200 sm:flex-row sm:items-center sm:justify-between">
        <p>Create a free account to try {feature}.</p>
        <div className="flex gap-2">
          <a href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`} className={`${ui.primary} h-10 flex-1 px-4 sm:flex-none`}>
            Sign up free
          </a>
          <a href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className={`${ui.secondary} h-10 flex-1 sm:flex-none`}>
            Log in
          </a>
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-accent/30 bg-accent/10 p-4 text-sm text-slate-200 sm:flex-row sm:items-center sm:justify-between">
      <p>
        <span className={`${ui.proBadge} mr-2`}>Pro</span>
        {kind === "trial" ? `${feature} is a Pro feature. Free includes ${detail ?? "a small daily trial"}.` : `${feature} is part of Pro.`}
      </p>
      <a href="/pricing" className={`${ui.secondary} h-10 shrink-0`}>
        See plans
      </a>
    </div>
  );
}
