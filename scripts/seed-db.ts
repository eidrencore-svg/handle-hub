/**
 * Seed Supabase `platforms` + `selftest_runs` from a catalog self-test, and
 * self-test the 10 hand-tuned adapters. Service role required (SUPABASE_SERVICE_ROLE_KEY).
 *
 *   npx tsx scripts/seed-db.ts      # re-seed from data/sites/selftest-results.generated.json
 */
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../lib/supabase/types";
import type { CatalogFile } from "../lib/engine/types";
import type { DefResult } from "./selftest";
import { signupUrlFor } from "../lib/engine/signup";
import { randomHandle } from "../lib/engine/random";
import { loadEnvLocal } from "./env";

const CORE_KNOWN: Record<string, string> = {
  steam: "ninja", xbox: "Spiken8", playstation: "ninja", twitch: "ninja", twitter: "ninja",
  instagram: "cristiano", tiktok: "ninja", discord: "ninja", reddit: "spez", youtube: "mrbeast",
};

function client() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return createClient<Database>(url, key, { auth: { persistSession: false } });
}

async function healthScores(sb: NonNullable<ReturnType<typeof client>>, ids: string[]) {
  // Fraction of the last 5 self-test runs that passed, per platform.
  const runs = new Map<string, boolean[]>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from("selftest_runs")
      .select("platform_id, passed, run_at")
      .gte("run_at", new Date(Date.now() - 30 * 86400_000).toISOString())
      .order("run_at", { ascending: false })
      .range(from, from + 999);
    if (error || !data?.length) break;
    for (const r of data) {
      const arr = runs.get(r.platform_id) ?? [];
      if (arr.length < 5) arr.push(Boolean(r.passed));
      runs.set(r.platform_id, arr);
    }
    if (data.length < 1000) break;
  }
  const out = new Map<string, number>();
  for (const id of ids) {
    const arr = runs.get(id);
    if (arr?.length) out.set(id, Math.round((arr.filter(Boolean).length / arr.length) * 1000) / 1000);
  }
  return out;
}

export async function seedSelftest(catalog: CatalogFile, results: DefResult[], enabled: Record<string, string>) {
  const sb = client();
  if (!sb) {
    console.log("[seed] no Supabase service credentials; skipped DB seeding");
    return;
  }
  const now = new Date().toISOString();
  const bySite = new Map<string, DefResult[]>();
  for (const r of results) bySite.set(r.site, [...(bySite.get(r.site) ?? []), r]);
  const defs = new Map(catalog.defs.map((d) => [d.id, d]));

  const platforms = [...bySite.entries()].map(([site, rs]) => {
    const chosenId = enabled[site] ?? rs[0].defId;
    const d = defs.get(chosenId)!;
    const last = rs[rs.length - 1];
    return {
      id: site,
      name: d.name,
      category: d.category,
      source: d.source,
      definition_id: chosenId,
      enabled: Boolean(enabled[site]),
      nsfw: d.nsfw,
      url_template: d.urlTemplate,
      url_main: d.urlMain ?? null,
      signup_url: signupUrlFor(d.urlMain || d.urlTemplate) ?? null,
      last_selftest_at: now,
      selftest_passed: Boolean(enabled[site]),
      notes: enabled[site] ? null : `self-test failed: ${last.reason ?? "unknown"}`,
    };
  });
  for (let i = 0; i < platforms.length; i += 500) {
    const { error } = await sb.from("platforms").upsert(platforms.slice(i, i + 500), { onConflict: "id" });
    if (error) throw new Error(`platforms upsert: ${error.message}`);
  }

  const runs = [...bySite.entries()].map(([site, rs]) => {
    const r = rs.find((x) => x.passed) ?? rs[rs.length - 1];
    return {
      platform_id: site,
      definition_id: r.defId,
      run_at: now,
      taken_ok: r.takenStatus === "taken",
      available_ok: r.randomStatus === "available" && (r.random2Status ?? "available") === "available",
      details: {
        latencyMs: r.latencyMs,
        reason: r.reason,
        takenUser: r.takenUser,
        takenHttp: r.takenHttp ?? null,
        randomHttp: r.randomHttp ?? null,
        tried: rs.map((x) => ({ defId: x.defId, reason: x.reason })),
      },
    };
  });
  for (let i = 0; i < runs.length; i += 500) {
    const { error } = await sb.from("selftest_runs").insert(runs.slice(i, i + 500));
    if (error) throw new Error(`selftest_runs insert: ${error.message}`);
  }

  const scores = await healthScores(sb, platforms.map((p) => p.id));
  const updates = platforms.map((p) => ({ ...p, health_score: scores.get(p.id) ?? (p.enabled ? 1 : 0) }));
  for (let i = 0; i < updates.length; i += 500) {
    await sb.from("platforms").upsert(updates.slice(i, i + 500), { onConflict: "id" });
  }
  console.log(`[seed] platforms upserted=${platforms.length} enabled=${platforms.filter((p) => p.enabled).length} runs=${runs.length}`);
}

/** Self-test the hand-tuned adapters (known taken + random available). */
export async function seedCoreSelftest() {
  const sb = client();
  const { adapters } = await import("../lib/platforms");
  const rows = [];
  for (const a of adapters) {
    const known = CORE_KNOWN[a.id] ?? "ninja";
    const rnd = randomHandle("^[a-z0-9]{3,15}$", 12);
    const t0 = Date.now();
    const [t, r] = await Promise.all([a.checkUsername(known), a.checkUsername(rnd)]);
    const row = {
      platform_id: a.id,
      definition_id: `adapter:${a.id}`,
      taken_ok: t.status === "taken",
      available_ok: r.status === "available",
      details: { takenUser: known, takenStatus: t.status, randomStatus: r.status, method: t.meta?.method ? String(t.meta.method) : null, latencyMs: Date.now() - t0 },
    };
    rows.push(row);
    console.log(`[core] ${a.id.padEnd(12)} known=${t.status.padEnd(9)} random=${r.status.padEnd(9)} ${row.taken_ok && row.available_ok ? "PASS" : "FAIL"}`);
  }
  if (!sb) return rows;
  await sb.from("selftest_runs").insert(rows);
  const scores = await healthScores(sb, rows.map((r) => r.platform_id));
  for (const r of rows) {
    await sb
      .from("platforms")
      .update({
        last_selftest_at: new Date().toISOString(),
        selftest_passed: r.taken_ok && r.available_ok,
        health_score: scores.get(r.platform_id) ?? null,
      })
      .eq("id", r.platform_id);
  }
  return rows;
}

if (process.argv[1]?.endsWith("seed-db.ts")) {
  (async () => {
    const root = process.cwd();
    const catalog = JSON.parse(fs.readFileSync(path.join(root, "data/sites/catalog.generated.json"), "utf8")) as CatalogFile;
    const { results } = JSON.parse(fs.readFileSync(path.join(root, "data/sites/selftest-results.generated.json"), "utf8")) as { results: DefResult[] };
    const enabled: Record<string, string> = {};
    for (const r of results) if (r.passed) enabled[r.site] = r.defId;
    await seedSelftest(catalog, results, enabled);
    await seedCoreSelftest();
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
