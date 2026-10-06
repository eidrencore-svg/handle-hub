import fs from "node:fs";
import path from "node:path";
import type { CatalogFile, SelftestFile, SiteDef } from "./types";
import { buildCatalog } from "./build";
import { getEnabledCatalogSites } from "@/lib/supabase/repo";

const DATA_DIR = path.join(process.cwd(), "data", "sites");
const CATALOG_FILE = path.join(DATA_DIR, "catalog.generated.json");

type Catalog = { defs: Map<string, SiteDef>; generatedAt: string; origin: "file" | "runtime" };

let catalogMemo: Catalog | null = null;
let building: Promise<Catalog> | null = null;
let lastFailure: { at: number; message: string } | null = null;
let enabledMemo: { at: number; sites: SiteDef[]; source: "db" | "file" } | null = null;
const ENABLED_TTL_MS = 5 * 60 * 1000;
const RETRY_AFTER_FAILURE_MS = 20_000;

function toCatalog(file: CatalogFile, origin: Catalog["origin"]): Catalog {
  const defs = new Map<string, SiteDef>();
  for (const d of file.defs ?? []) defs.set(d.id, d);
  return { defs, generatedAt: file.generatedAt, origin };
}

function readCatalogFile(): Catalog | null {
  try {
    const file = JSON.parse(fs.readFileSync(CATALOG_FILE, "utf8")) as CatalogFile;
    if (!Array.isArray(file.defs) || file.defs.length === 0) return null;
    return toCatalog(file, "file");
  } catch {
    return null;
  }
}

export class CatalogUnavailableError extends Error {}

/**
 * The merged catalog. Normally generated at build time (`npm run catalog`,
 * also run by `predev`/`prebuild`); if it is missing (fresh clone, failed
 * download, read-only deploy) the server downloads the pinned upstream files
 * once (raw.githubusercontent.com → jsDelivr), builds it in memory and tries
 * to cache it on disk.
 */
export async function ensureCatalog(): Promise<Catalog> {
  if (catalogMemo) return catalogMemo;
  const fromDisk = readCatalogFile();
  if (fromDisk) return (catalogMemo = fromDisk);
  if (lastFailure && Date.now() - lastFailure.at < RETRY_AFTER_FAILURE_MS) {
    throw new CatalogUnavailableError(lastFailure.message);
  }
  if (!building) {
    building = (async () => {
      try {
        const file = await buildCatalog();
        if (!file.defs.length) throw new Error("upstream catalogs were empty");
        try {
          fs.mkdirSync(DATA_DIR, { recursive: true });
          fs.writeFileSync(CATALOG_FILE, JSON.stringify(file));
        } catch {
          /* read-only filesystem: keep it in memory */
        }
        lastFailure = null;
        return (catalogMemo = toCatalog(file, "runtime"));
      } catch (err) {
        const message = `Couldn't download the site catalog (${err instanceof Error ? err.message : String(err)}). Check this server's internet connection, then retry.`;
        lastFailure = { at: Date.now(), message };
        throw new CatalogUnavailableError(message);
      } finally {
        building = null;
      }
    })();
  }
  return building;
}

/** True when the catalog is already in memory or on disk (no download needed). */
export function catalogReady(): boolean {
  return Boolean(catalogMemo || readCatalogFile());
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
 * Throws CatalogUnavailableError if the catalog can't be loaded or downloaded.
 */
export async function getEnabledSites(opts: { includeNsfw?: boolean } = {}): Promise<{ sites: SiteDef[]; source: "db" | "file" }> {
  if (!opts.includeNsfw && enabledMemo && Date.now() - enabledMemo.at < ENABLED_TTL_MS) {
    return { sites: enabledMemo.sites, source: enabledMemo.source };
  }
  const { defs } = await ensureCatalog();
  const fileEntries = (): Array<[string, string]> => {
    const out: Array<[string, string]> = [];
    const enabled = loadSelftestFile()?.enabled ?? {};
    for (const [src, slugs] of Object.entries(enabled)) {
      for (const slug of slugs ?? []) {
        const d = defs.get(`${src}:${slug}`);
        if (d) out.push([d.site, d.id]);
      }
    }
    return out;
  };
  let source: "db" | "file" = "file";
  let entries: Array<[string, string]> = [];
  const db = await getEnabledCatalogSites().catch(() => null);
  if (db && db.size > 0) {
    source = "db";
    entries = [...db.entries()].map(([site, v]) => [site, v.defId]);
    // DB rows that don't resolve against this catalog (e.g. different pin) → use the file list.
    if (!entries.some(([, id]) => defs.has(id))) {
      source = "file";
      entries = fileEntries();
    }
  } else {
    entries = fileEntries();
  }
  const sites: SiteDef[] = [];
  for (const [, defId] of entries) {
    const d = defs.get(defId);
    if (!d) continue;
    if (d.nsfw && !opts.includeNsfw) continue;
    sites.push(d);
  }
  sites.sort((a, b) => a.name.localeCompare(b.name));
  if (!opts.includeNsfw && sites.length) enabledMemo = { at: Date.now(), sites, source };
  return { sites, source };
}

export async function catalogStats() {
  const st = loadSelftestFile();
  try {
    const { defs, generatedAt, origin } = await ensureCatalog();
    return { definitions: defs.size, sites: new Set([...defs.values()].map((d) => d.site)).size, generatedAt, origin, selftest: st?.totals ?? null, error: null as string | null };
  } catch (err) {
    return { definitions: 0, sites: 0, generatedAt: "", origin: null, selftest: st?.totals ?? null, error: err instanceof Error ? err.message : String(err) };
  }
}
