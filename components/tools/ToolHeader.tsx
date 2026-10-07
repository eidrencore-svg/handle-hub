import { ui } from "@/components/ui/styles";

export function ToolHeader({ title, line, pro, back = true }: { title: string; line: string; pro?: boolean; back?: boolean }) {
  return (
    <div>
      {back ? (
        <a href="/tools" className="mb-2 inline-block text-xs text-slate-400 hover:text-white">
          ← Tools
        </a>
      ) : null}
      <div className="flex items-center gap-2">
        <h1 className={ui.h1}>{title}</h1>
        {pro ? <span className={ui.proBadge}>Pro</span> : null}
      </div>
      <p className={ui.sub}>{line}</p>
    </div>
  );
}
