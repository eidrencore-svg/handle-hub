import { ui } from "@/components/ui/styles";

export function ToolHeader({ title, line, pro }: { title: string; line: string; pro?: boolean }) {
  return (
    <div>
      <a href="/tools" className="text-xs text-slate-400 hover:text-white">
        ← Tools
      </a>
      <div className="mt-2 flex items-center gap-2">
        <h1 className={ui.h1}>{title}</h1>
        {pro ? <span className={ui.proBadge}>Pro</span> : null}
      </div>
      <p className={ui.sub}>{line}</p>
    </div>
  );
}
