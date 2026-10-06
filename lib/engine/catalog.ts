import fs from "node:fs";
import path from "node:path";
import type { CatalogFile, SelftestFile, SiteDef } from "./types";
import { getEnabledCatalogSites } from "@/lib/supabase/repo";

const DATA_DIR = path.join(process.cwd(), "data", "sites");

let catalogMemo: { defs: Map<string, SiteDef>; generatedAt: string } | null = null;
let enabledMemo: { at: number; sites: SiteDef[]; source: "db" | "file" } | null = null;
const ENABLED_TTL_MS = 5 * 60 * 1000;

function loadCatalog() {
  if (catalogMemo) return catalogMemo;
  const defs = new Map<string, SiteDef>();
  let generatedAt = "";
  try {
    const file = JSON.parse(fs.readFileSync(path.join(DATA_DIR, "catalog.generated.json"), "utf8")) as CatalogFile;
    generatedAt = file.generatedAt;
    for (const d of file.defs) defs.set(d.id, d);
  } catch {
    /* catalog not built: scan only reports what it can */
  }
  catalogMemo = { defs, generatedAt };
  return catalogMemo;
}

function loadSelftestFile(): SelftestFile | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, "selftest.json"), "utf8")) as SelftestFile;
  } catch {
    return null;
  }
}

/**
 * Enabled, non-NSFW catalog sites. The DB (`platforms.enabled`, refreshed by
 * `npm run selftest`) wins; the committed data/sites/selftest.json is the fallback.
 */
export async function getEnabledSites(opts: { includeNsfw?: boolean } = {}): Promise<{ sites: SiteDef[]; source: "db" | "file" }> {
  if (!opts.includeNsfw && enabledMemo && Date.now() - enabledMemo.at < ENABLED_TTL_MS) {
    return { sites: enabledMemo.sites, source: enabledMemo.source };
  }
  const { defs } = loadCatalog();
  let source: "db" | "file" = "file";
  let entries: Array<[string, string]> = [];
  const db = await getEnabledCatalogSites();
  if (db && db.size > 0) {
    source = "db";
    entries = [...db.entries()].map(([site, v]) => [site, v.defId]);
  } else {
    const enabled = loadSelftestFile()?.enabled ?? {};
    for (const [src, slugs] of Object.entries(enabled)) {
      for (const slug of slugs ?? []) {
        const d = defs.get(`${src}:${slug}`);
        if (d) entries.push([d.site, d.id]);
      }
    }
  }
  const sites: SiteDef[] = [];
  for (const [, defId] of entries) {
    const d = defs.get(defId);
    if (!d) continue;
    if (d.nsfw && !opts.includeNsfw) continue;
    sites.push(d);
  }
  sites.sort((a, b) => a.name.localeCompare(b.name));
  if (!opts.includeNsfw) enabledMemo = { at: Date.now(), sites, source };
  return { sites, source };
}

export function catalogStats() {
  const { defs, generatedAt } = loadCatalog();
  const st = loadSelftestFile();
  return { definitions: defs.size, sites: new Set([...defs.values()].map((d) => d.site)).size, generatedAt, selftest: st?.totals ?? null };
}
