import { ui } from "@/components/ui/styles";

/** Centered, phone-first card used by /login, /signup and the password pages. */
export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-md pt-2 sm:pt-6">
      <h1 className="text-balance text-center text-2xl font-semibold tracking-tight text-white sm:text-3xl">{title}</h1>
      {subtitle ? <p className="mt-2 text-balance text-center text-sm text-slate-400">{subtitle}</p> : null}
      <div className={`${ui.card} mt-6`}>{children}</div>
      {footer ? <div className="mt-5 text-center text-sm text-slate-400">{footer}</div> : null}
    </div>
  );
}
