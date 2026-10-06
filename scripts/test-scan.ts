/**
 * Smoke test the catalog engine without the web server:
 *   npm run test:scan [-- ninja]
 * Scans a known handle and a random string; reports counts and the
 * false-positive rate (sites claiming "taken" for the random string).
 */
import { loadEnvLocal } from "./env";
loadEnvLocal();
import { getEnabledSites } from "../lib/engine/catalog";
import { scanSites } from "../lib/engine/scan";
import { randomHandle } from "../lib/engine/random";

async function run(username: string, sites: Awaited<ReturnType<typeof getEnabledSites>>["sites"]) {
  const t0 = Date.now();
  const counts: Record<string, number> = { taken: 0, available: 0, unknown: 0, invalid: 0 };
  const taken: string[] = [];
  for await (const item of scanSites(username, sites, { concurrency: 48, perHost: 2, timeoutMs: 8_000, deadline: Date.now() + 120_000 })) {
    counts[item.status]++;
    if (item.status === "taken") taken.push(item.site);
  }
  return { username, counts, taken, seconds: (Date.now() - t0) / 1000 };
}

(async () => {
  const { sites, source } = await getEnabledSites();
  console.log(`[scan] enabled sites: ${sites.length} (source: ${source})`);
  const known = process.argv[2] || "ninja";
  const a = await run(known, sites);
  console.log(`[scan] ${a.username}: ${JSON.stringify(a.counts)} in ${a.seconds.toFixed(1)}s`);
  const rnd = randomHandle(undefined, 14);
  const b = await run(rnd, sites);
  const fp = b.counts.taken / Math.max(1, sites.length);
  console.log(`[scan] ${b.username}: ${JSON.stringify(b.counts)} in ${b.seconds.toFixed(1)}s`);
  console.log(`[scan] false-positive rate on random handle: ${(fp * 100).toFixed(2)}% (${b.counts.taken}/${sites.length})`);
  if (b.taken.length) console.log(`[scan] sites claiming taken for random: ${b.taken.join(", ")}`);
})();
