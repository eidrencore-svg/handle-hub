/**
 * Normalized site definition shared by every catalog source
 * (WhatsMyName, Sherlock, Maigret). See THIRD_PARTY.md for licenses.
 */
export type CatalogSource = "wmn" | "sherlock" | "maigret";
export type DetectMode = "wmn" | "status" | "message" | "redirect";

export type SiteCategory =
  | "social"
  | "gaming"
  | "dev"
  | "creative"
  | "business"
  | "community"
  | "other";

export interface SiteDef {
  /** Definition id: `${source}:${slug}` (unique per upstream entry). */
  id: string;
  /** Site key shared by duplicate definitions across sources (= platforms.id). */
  site: string;
  name: string;
  source: CatalogSource;
  license: "CC-BY-SA-4.0" | "MIT";
  category: SiteCategory;
  tags?: string[];
  nsfw: boolean;
  urlMain?: string;
  /** Public profile URL, `{u}` = username. */
  urlTemplate: string;
  /** URL actually requested, `{u}` = username. */
  probeUrl: string;
  method: "GET" | "POST" | "HEAD";
  body?: string;
  headers?: Record<string, string>;
  mode: DetectMode;
  existsCodes?: number[];
  missingCodes?: number[];
  existsMarkers?: string[];
  missingMarkers?: string[];
  /** Body markers meaning "site error / captcha / rate limit" → unknown. */
  errorMarkers?: string[];
  errorUrl?: string;
  regexCheck?: string;
  /** Known registered usernames from the upstream catalog (self-test). */
  known: string[];
  unclaimed?: string;
  stripBadChar?: string;
  ignore403?: boolean;
  followRedirects: boolean;
}

export type SiteStatus = "taken" | "available" | "unknown" | "invalid";

export interface ProbeResult {
  site: string;
  defId: string;
  status: SiteStatus;
  httpStatus?: number;
  latencyMs: number;
  reason?: string;
  profileUrl?: string;
}

export interface CatalogFile {
  generatedAt: string;
  upstream: Record<CatalogSource, { repo: string; sha: string; license: string }>;
  defs: SiteDef[];
}

/**
 * Committed self-test output (fallback when the DB is unreachable):
 * passing definition slugs per source; `${source}:${slug}` is the definition id.
 */
export interface SelftestFile {
  generatedAt: string;
  totals: { sites: number; defsTested: number; passed: number; disabled: number };
  enabled: Partial<Record<CatalogSource, string[]>>;
}
