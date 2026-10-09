import type { Metadata } from "next";
import { PageShell } from "@/components/PageShell";
import { ui } from "@/components/ui/styles";
import { PLANS, PLAN_ORDER } from "@/lib/plans";
import { adapters } from "@/lib/platforms";

export const metadata: Metadata = {
  title: "API docs · Handle Hub",
  description: "Put Handle Hub's checks inside your own app.",
};

const code = "block overflow-x-auto whitespace-pre rounded-xl bg-ink-950/80 p-4 font-mono text-xs leading-relaxed text-slate-200 ring-1 ring-white/10";

const EXAMPLE = `{
  "username": "ninja",
  "checkedAt": "2026-10-07T22:41:03.512Z",
  "summary": { "available": 1, "taken": 1, "unknown": 0, "invalid": 0 },
  "results": [
    {
      "platform": "twitch",
      "name": "Twitch",
      "kind": "gaming",
      "status": "taken",
      "reason": "profile_found",
      "message": "…",
      "confidence": "high",
      "profileUrl": "https://www.twitch.tv/ninja",
      "checkUrl": "https://www.twitch.tv/ninja",
      "cached": false
    }
  ],
  "usage": { "plan": "pro", "usedToday": 42, "dailyLimit": 5000 }
}`;

export default function ApiDocsPage() {
  return (
    <PageShell width="max-w-3xl">
      <h1 className={ui.h1}>API</h1>
      <p className={ui.sub}>Put Handle Hub&apos;s checks inside your own app. One endpoint, honest statuses, JSON back.</p>

      <section className={`${ui.card} mt-6 space-y-4`}>
        <h2 className="text-sm font-semibold text-white">1. Get a key</h2>
        <p className="text-sm text-slate-400">
          Create one on <a href="/account/api-keys" className={ui.link}>your API keys page</a>. Keys start with{" "}
          <code className="text-slate-200">hh_</code> and are shown once. We only store a hash, so keep it somewhere safe and never put it in
          browser code.
        </p>
        <h2 className="pt-2 text-sm font-semibold text-white">2. Call the endpoint</h2>
        <code className={code}>{`curl -H "Authorization: Bearer hh_YOUR_KEY" \\
  "https://handle-hub-production.up.railway.app/api/v1/check?username=ninja&platforms=twitch,instagram"`}</code>
        <dl className="grid gap-3 text-sm sm:grid-cols-[140px_1fr]">
          <dt className="font-mono text-slate-200">username</dt>
          <dd className="text-slate-400">Required. 1–32 characters: letters, numbers, dot, underscore, hyphen.</dd>
          <dt className="font-mono text-slate-200">platforms</dt>
          <dd className="text-slate-400">
            Optional, comma-separated. Defaults to all core platforms:{" "}
            <span className="font-mono text-xs text-slate-300">{adapters.map((a) => a.id).join(", ")}</span>
          </dd>
        </dl>
        <h2 className="pt-2 text-sm font-semibold text-white">3. Read the result</h2>
        <code className={code}>{EXAMPLE}</code>
        <ul className="space-y-1.5 text-sm text-slate-400">
          <li>
            <span className="font-semibold text-emerald-300">available</span>: the platform gave a clear signal the name is free.
          </li>
          <li>
            <span className="font-semibold text-rose-300">taken</span>: an account exists (<code>profileUrl</code> when public).
          </li>
          <li>
            <span className="font-semibold text-amber-300">unknown</span>: Couldn&apos;t verify (a wall, rate limit or unclear answer). Never
            treated as available; open <code>checkUrl</code> to check by hand.
          </li>
          <li>
            <span className="font-semibold text-orange-300">invalid</span>: the name breaks that platform&apos;s rules.
          </li>
        </ul>
      </section>

      <section className={`${ui.card} mt-4 space-y-3`}>
        <h2 className="text-sm font-semibold text-white">Limits</h2>
        <p className="text-sm text-slate-400">
          Each request counts once against the key owner&apos;s daily quota (resets at midnight UTC). Every response carries{" "}
          <code className="text-slate-200">X-RateLimit-Limit</code>, <code className="text-slate-200">X-RateLimit-Remaining</code>,{" "}
          <code className="text-slate-200">X-RateLimit-Reset</code> and the per-minute equivalents.
        </p>
        <div className="-mx-1 overflow-x-auto">
          <table className="w-full min-w-[360px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
                <th className="px-1 py-2 font-medium">Plan</th>
                <th className="px-1 py-2 font-medium">Per day</th>
                <th className="px-1 py-2 font-medium">Per minute</th>
                <th className="px-1 py-2 font-medium">Keys</th>
              </tr>
            </thead>
            <tbody>
              {PLAN_ORDER.map((id) => (
                <tr key={id} className="border-t border-white/5 text-slate-300">
                  <td className="px-1 py-2">{PLANS[id].name}{id === "free" ? " (trial)" : ""}</td>
                  <td className="px-1 py-2 tabular-nums">{PLANS[id].limits.apiPerDay?.toLocaleString() ?? "Unlimited"}</td>
                  <td className="px-1 py-2 tabular-nums">{PLANS[id].limits.apiPerMinute}</td>
                  <td className="px-1 py-2 tabular-nums">{PLANS[id].limits.apiKeys}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className={`${ui.card} mt-4 space-y-3`}>
        <h2 className="text-sm font-semibold text-white">Errors</h2>
        <code className={code}>{`{ "error": { "code": "daily_quota_exceeded", "message": "…" } }`}</code>
        <dl className="grid gap-2 text-sm sm:grid-cols-[60px_1fr]">
          <dt className="font-mono text-slate-200">400</dt>
          <dd className="text-slate-400"><code>invalid_username</code></dd>
          <dt className="font-mono text-slate-200">401</dt>
          <dd className="text-slate-400"><code>unauthorized</code>: missing, invalid or revoked key</dd>
          <dt className="font-mono text-slate-200">429</dt>
          <dd className="text-slate-400">
            <code>rate_limited</code> (per minute) or <code>daily_quota_exceeded</code>. Wait for <code>Retry-After</code> seconds.
          </dd>
        </dl>
      </section>

      <p className="mt-8 text-center text-xs text-slate-500">
        Results are based on public signals. Always confirm on the platform before you commit.
      </p>
    </PageShell>
  );
}
