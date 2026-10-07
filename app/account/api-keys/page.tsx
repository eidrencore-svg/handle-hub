import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageShell } from "@/components/PageShell";
import { CreateApiKeyForm } from "@/components/CreateApiKeyForm";
import { ui } from "@/components/ui/styles";
import { createSupabaseServerClient, getCurrentUser } from "@/lib/supabase/ssr";
import { getAccountPlan, getUsageToday } from "@/lib/usage";
import { revokeApiKey } from "@/lib/apiKeys/actions";
import { PLANS } from "@/lib/plans";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "API keys · Handle Hub" };

const fmt = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" }) : "Never";

export default async function ApiKeysPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account/api-keys");
  const planId = await getAccountPlan(user.id, user.email);
  const limits = PLANS[planId].limits;
  const supabase = await createSupabaseServerClient();
  // RLS: users only ever see their own keys, and never the hash column.
  const { data: keys } = supabase
    ? await supabase
        .from("api_keys")
        .select("id, name, prefix, created_at, last_used_at, revoked_at")
        .order("created_at", { ascending: false })
    : { data: [] };
  const active = (keys ?? []).filter((k) => !k.revoked_at);
  const revoked = (keys ?? []).filter((k) => k.revoked_at);
  const usage = await getUsageToday(`u:${user.id}`);

  return (
    <PageShell width="max-w-3xl" plan={planId}>
      <a href="/account" className="text-xs text-slate-400 hover:text-white">
        ← Account
      </a>
      <h1 className={`${ui.h1} mt-2`}>API keys</h1>
      <p className={ui.sub}>
        Put Handle Hub&apos;s checks inside your own app. Send a key as <code className="text-slate-200">Authorization: Bearer hh_…</code>.{" "}
        <a href="/docs/api" className={ui.link}>
          Read the docs
        </a>
      </p>

      <div className="mt-6 grid grid-cols-3 gap-2 text-center">
        {[
          ["Today", `${(usage.api ?? 0).toLocaleString()} / ${limits.apiPerDay === null ? "∞" : limits.apiPerDay.toLocaleString()}`],
          ["Per minute", limits.apiPerMinute.toLocaleString()],
          ["Active keys", `${active.length} / ${limits.apiKeys}`],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl border border-white/10 bg-ink-800/50 px-2 py-3">
            <p className="text-[11px] uppercase tracking-wider text-slate-500">{k}</p>
            <p className="mt-1 text-sm font-semibold tabular-nums text-white">{v}</p>
          </div>
        ))}
      </div>
      {planId === "free" ? (
        <p className={`${ui.noteBox} mt-3`}>
          Free includes an API trial ({limits.apiPerDay} requests a day). API access is part of Pro.{" "}
          <a href="/pricing" className="font-semibold underline underline-offset-2">
            See plans
          </a>
        </p>
      ) : null}

      <section className={`${ui.card} mt-4`} aria-labelledby="new-key">
        <h2 id="new-key" className="text-sm font-semibold text-white">
          Create a key
        </h2>
        <div className="mt-3">
          <CreateApiKeyForm disabled={active.length >= limits.apiKeys} />
        </div>
      </section>

      <section className="mt-6" aria-labelledby="your-keys">
        <h2 id="your-keys" className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
          Your keys
        </h2>
        {active.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-white/10 bg-ink-800/50 px-4 py-6 text-center text-sm text-slate-400">No active keys yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {active.map((k) => (
              <li key={k.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-ink-900/70 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">{k.name}</p>
                  <p className="mt-0.5 font-mono text-xs text-slate-400">{k.prefix}…</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Created {fmt(k.created_at)} · Last used {fmt(k.last_used_at)}
                  </p>
                </div>
                <form action={revokeApiKey}>
                  <input type="hidden" name="id" value={k.id} />
                  <button type="submit" className={ui.danger}>
                    Revoke
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        {revoked.length ? (
          <details className="mt-4 text-sm text-slate-400">
            <summary className="cursor-pointer select-none">Revoked keys ({revoked.length})</summary>
            <ul className="mt-2 space-y-1">
              {revoked.map((k) => (
                <li key={k.id} className="flex justify-between gap-3 rounded-xl px-3 py-2 text-xs text-slate-500 ring-1 ring-white/5">
                  <span className="truncate">
                    {k.name} · <span className="font-mono">{k.prefix}…</span>
                  </span>
                  <span>revoked {fmt(k.revoked_at)}</span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>
    </PageShell>
  );
}
