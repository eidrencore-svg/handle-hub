/**
 * Live smoke test of the 10 core adapters (including the automatic second pass):
 * known-taken handles per platform, a random unused handle and `zixx__zuu`.
 *   npm run test:adapters               # all platforms
 *   npm run test:adapters -- tiktok reddit
 * A "taken" result for the random handle is a false positive; an "available"
 * result for a known handle is a false negative. Unknown is reported, not guessed.
 */
import { loadEnvLocal } from "./env";
loadEnvLocal();
import { adapters, checkPlatformsSelective } from "../lib/platforms";
import { randomHandle } from "../lib/engine/random";

const KNOWN: Record<string, string[]> = {
  instagram: ["instagram", "cristiano", "natgeo"],
  tiktok: ["tiktok", "khaby.lame", "charlidamelio"],
  reddit: ["spez", "kn0thing"],
  discord: ["ninja", "everyone"],
  default: ["ninja", "mrbeast"],
};

const pad = (s: string, n: number) => s.padEnd(n).slice(0, n);

async function main() {
  const only = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  const ids = adapters.map((a) => a.id).filter((id) => !only.length || only.includes(id));
  const random = randomHandle(undefined, 12);
  let fp = 0;
  let fn = 0;
  let unknown = 0;
  let total = 0;
  console.log([pad("platform", 11), pad("handle", 14), pad("expect", 9), pad("status", 10), pad("conf", 6), pad("pass", 4), pad("method", 22), "tried"].join(" | "));
  console.log("-".repeat(130));
  for (const id of ids) {
    const cases: Array<[string, string]> = [
      ...(KNOWN[id] ?? KNOWN.default).map((h) => [h, "taken"] as [string, string]),
      [random, "available"],
      ["zixx__zuu", "?"],
    ];
    for (const [handle, expect] of cases) {
      const [r] = await checkPlatformsSelective(handle, [id]);
      total++;
      if (expect === "available" && r.status === "taken") fp++;
      if (expect === "taken" && r.status === "available") fn++;
      if (r.status === "unknown") unknown++;
      const tried = Array.isArray(r.meta?.tried)
        ? (r.meta.tried as Array<{ method: string; outcome: string }>).map((t) => `${t.method}=${t.outcome}`).join(", ")
        : "";
      console.log(
        [pad(id, 11), pad(handle, 14), pad(expect, 9), pad(r.status, 10), pad(r.confidence ?? "-", 6), pad(String(r.pass), 4), pad(String(r.meta?.method ?? "-"), 22), tried || (r.userMessage ?? "")].join(" | ")
      );
    }
  }
  console.log(`\n${total} checks · false positives ${fp} · false negatives ${fn} · unknown ${unknown}`);
  if (fp || fn) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
