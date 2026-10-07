import { METRIC_LABEL, metricLimit, type Limits, type Metric } from "@/lib/plans";

const METRICS: Metric[] = ["core_check", "full_scan", "domain_check", "tool_run", "api"];

export function UsageMeter({ usage, limits }: { usage: Partial<Record<Metric, number>>; limits: Limits }) {
  return (
    <ul className="space-y-3">
      {METRICS.map((m) => {
        const used = usage[m] ?? 0;
        const limit = metricLimit(limits, m);
        const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : limit === null ? 0 : 100;
        return (
          <li key={m}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-slate-300">{METRIC_LABEL[m]}</span>
              <span className="tabular-nums text-slate-400">
                <span className="text-white">{used.toLocaleString()}</span> / {limit === null ? "unlimited" : limit === 0 ? "not included" : limit.toLocaleString()}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/5">
              <div
                className={`h-full rounded-full ${pct >= 100 ? "bg-rose-400" : pct >= 80 ? "bg-amber-400" : "bg-gradient-to-r from-accent to-accent-glow"}`}
                style={{ width: `${limit === null ? Math.min(100, used ? 6 : 0) : pct}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
