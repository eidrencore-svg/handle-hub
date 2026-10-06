/**
 * Build data/sites/catalog.generated.json from pinned WhatsMyName (CC BY-SA 4.0),
 * Sherlock (MIT) and Maigret (MIT) data. The generated file keeps per-entry
 * source + license and is not committed (see THIRD_PARTY.md). The server builds
 * the same catalog on demand if this file is missing (lib/engine/catalog.ts).
 *
 *   npm run catalog            # download (cached in data/upstream/) + normalize
 *   npm run catalog -- --if-missing
 */
import fs from "node:fs";
import path from "node:path";
import { buildCatalog, fetchUpstream } from "../lib/engine/build";
import { UPSTREAM, type UpstreamKey } from "../lib/engine/upstream";

const ROOT = process.cwd();
const UP_DIR = path.join(ROOT, "data", "upstream");
const OUT = path.join(ROOT, "data", "sites", "catalog.generated.json");

async function loadCached(key: UpstreamKey): Promise<unknown> {
  fs.mkdirSync(UP_DIR, { recursive: true });
  const file = path.join(UP_DIR, `${key}-${UPSTREAM[key].sha.slice(0, 12)}.json`);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, "utf8"));
  const data = await fetchUpstream(key);
  fs.writeFileSync(file, JSON.stringify(data));
  return data;
}

function hasCatalog(): boolean {
  try {
    const file = JSON.parse(fs.readFileSync(OUT, "utf8")) as { defs?: unknown[] };
    return Array.isArray(file.defs) && file.defs.length > 0;
  } catch {
    return false;
  }
}

async function main() {
  if (process.argv.includes("--if-missing") && hasCatalog()) {
    console.log("[catalog] exists, skipping");
    return;
  }
  try {
    const cat = await buildCatalog(loadCached);
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, JSON.stringify(cat));
    const sites = new Set(cat.defs.map((d) => d.site)).size;
    const bySrc = cat.defs.reduce<Record<string, number>>((a, d) => ((a[d.source] = (a[d.source] ?? 0) + 1), a), {});
    console.log(`[catalog] ${cat.defs.length} definitions → ${sites} sites`, bySrc);
  } catch (err) {
    // Never write an empty catalog: the server retries the download on demand.
    console.warn("[catalog] build failed:", err instanceof Error ? err.message : err);
    console.warn("[catalog] continuing; the server will download the catalog on first scan");
  }
}

void main();
