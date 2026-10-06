/**
 * Catalog self-test: a site definition is enabled only if
 *   (1) its upstream known account comes back "taken", and
 *   (2) two random handles both come back "available".
 * Sites are tested per group in priority order (WMN > Maigret > Sherlock) and the
 * first passing definition wins.
 *
 *   npm run selftest              # test + write data/sites/selftest.json + seed Supabase (if service key)
 *   npm run selftest -- --limit 200 --no-db
 */
import fs from "node:fs";
import path from "node:path";
import { buildCatalog } from "./build-catalog";
import { probeSite } from "../lib/engine/detect";
import { createPool, hostOf } from "../lib/engine/pool";
import { randomHandle } from "../lib/engine/random";
import type { CatalogFile, SelftestFile, SiteDef } from "../lib/engine/types";

const ROOT = process.cwd();
const CATALOG = path.join(ROOT, "data", "sites", "catalog.generated.json");
const OUT = path.join(ROOT, "data", "sites", "selftest.json");
const DETAILS = path.join(ROOT, "data", "sites", "selftest-results.generated.json");

/** Sites slower than this on average are disabled (they would stall scans). */
const SLOW_MS = 4_000;

export interface DefResult {
  defId: string;
  site: string;
  takenUser: string;
  takenStatus: string;
  takenHttp?: number;
  randomUser: string;
  randomStatus: string;
  randomHttp?: number;
  random2Status?: string;
  passed: boolean;
  latencyMs: number;
  reason?: string;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function testDef(def: SiteDef): Promise<DefResult> {
  const takenUser = def.known[0];
  const t = await probeSite(def, takenUser, { timeoutMs: 12_000, retries: 1 });
  const randomUser = randomHandle(def.regexCheck);
  const base = { defId: def.id, site: def.site, takenUser, takenStatus: t.status, takenHttp: t.httpStatus, randomUser };
  if (t.status !== "taken") {
    return { ...base, randomStatus: "skipped", passed: false, latencyMs: t.latencyMs, reason: `known→${t.status}:${t.reason}` };
  }
  const r = await probeSite(def, randomUser, { timeoutMs: 12_000, retries: 1 });
  if (r.status !== "available") {
    return { ...base, randomStatus: r.status, randomHttp: r.httpStatus, passed: false, latencyMs: t.latencyMs + r.latencyMs, reason: `random→${r.status}:${r.reason}` };
  }
  const r2 = await probeSite(def, randomHandle(def.regexCheck, 14), { timeoutMs: 12_000, retries: 1 });
  const latencyMs = Math.round((t.latencyMs + r.latencyMs + r2.latencyMs) / 3);
  const slow = latencyMs > SLOW_MS;
  const passed = r2.status === "available" && !slow;
  return {
    ...base,
    randomStatus: r.status,
    randomHttp: r.httpStatus,
    random2Status: r2.status,
    passed,
    latencyMs,
    reason: passed ? "ok" : slow ? `slow:${latencyMs}ms` : `random2→${r2.status}:${r2.reason}`,
  };
}

function compactEnabled(defIds: string[]): SelftestFile["enabled"] {
  const out: SelftestFile["enabled"] = {};
  for (const id of defIds.sort()) {
    const [src, slug] = [id.slice(0, id.indexOf(":")), id.slice(id.indexOf(":") + 1)] as [keyof SelftestFile["enabled"], string];
    (out[src] ??= []).push(slug);
  }
  return out;
}

async function main() {
  let catalog: CatalogFile;
  if (fs.existsSync(CATALOG)) catalog = JSON.parse(fs.readFileSync(CATALOG, "utf8"));
  else {
    catalog = await buildCatalog();
    fs.writeFileSync(CATALOG, JSON.stringify(catalog));
  }
  const groups = new Map<string, SiteDef[]>();
  for (const d of catalog.defs) {
    if (!groups.has(d.site)) groups.set(d.site, []);
    groups.get(d.site)!.push(d);
  }
  let sites = [...groups.keys()];
  const limit = Number(arg("--limit") ?? 0);
  if (limit > 0) sites = sites.slice(0, limit);

  const concurrency = Number(arg("--concurrency") ?? 24);
  const schedule = createPool(concurrency, 2);
  const results: DefResult[] = [];
  const enabled: Record<string, string> = {};
  let done = 0;
  const t0 = Date.now();

  await Promise.all(
    sites.map(async (site) => {
      for (const def of groups.get(site)!) {
        const res = await schedule(hostOf(def.probeUrl), () => testDef(def));
        results.push(res);
        if (res.passed) {
          enabled[site] = def.id;
          break;
        }
      }
      done++;
      if (done % 100 === 0 || done === sites.length) {
        const passed = Object.keys(enabled).length;
        console.log(`[selftest] ${done}/${sites.length} sites · ${passed} passing · ${Math.round((Date.now() - t0) / 1000)}s`);
      }
    })
  );

  const passedSites = Object.keys(enabled).length;
  const out: SelftestFile = {
    generatedAt: new Date().toISOString(),
    totals: { sites: sites.length, defsTested: results.length, passed: passedSites, disabled: sites.length - passedSites },
    enabled: compactEnabled(Object.values(enabled)),
  };
  fs.writeFileSync(OUT, JSON.stringify(out).replace(/\],"/g, '],\n"'));
  fs.writeFileSync(DETAILS, JSON.stringify({ generatedAt: out.generatedAt, results }));
  console.log(`[selftest] sites=${out.totals.sites} defsTested=${out.totals.defsTested} passed=${passedSites} disabled=${out.totals.disabled}`);
  const reasons = results.filter((r) => !r.passed).reduce<Record<string, number>>((a, r) => {
    const k = (r.reason ?? "").replace(/:.*/, "") + ":" + (r.reason ?? "").split(":")[1]?.replace(/_\d+$/, "_xxx");
    a[k] = (a[k] ?? 0) + 1;
    return a;
  }, {});
  console.log("[selftest] failure reasons", Object.entries(reasons).sort((a, b) => b[1] - a[1]).slice(0, 12));

  if (!process.argv.includes("--no-db")) {
    const { seedSelftest, seedCoreSelftest } = await import("./seed-db");
    await seedSelftest(catalog, results, enabled);
    await seedCoreSelftest();
  }
}

if (process.argv[1]?.endsWith("selftest.ts")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
