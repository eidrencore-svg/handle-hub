/**
 * Plans, limits and prices: the single source of truth.
 *
 * PRICES ARE NOT DECIDED YET. `null` renders as "Pricing coming soon".
 * When the user approves a price, change ONE line in PRICES_USD_MONTHLY, e.g.
 *   pro: 9,      // ← proposed, not approved
 *   team: 29,    // ← proposed, not approved
 */
import { WATCHLIST_ALERTS_SUFFIX } from "./watchlist/config";

export const PRICES_USD_MONTHLY: Record<PlanId, number | null> = {
  free: 0,
  pro: null,
  team: null,
};

export type PlanId = "free" | "pro" | "team";
/** Usage counters enforced per UTC day. */
export type Metric = "core_check" | "full_scan" | "api" | "tool_run" | "domain_check";

export type Limits = {
  /** Core 10-platform checks per day (null = unlimited). */
  coreChecksPerDay: number | null;
  /** Full 1,500+ site scans per day. */
  fullScansPerDay: number | null;
  /** Domain-check lookups per day. */
  domainChecksPerDay: number | null;
  /** Bulk / variant / suggestion runs per day (Pro tools; Free gets a small trial). */
  toolRunsPerDay: number | null;
  /** Max handles in one bulk check. */
  bulkMaxHandles: number;
  /** Watchlist slots (handle × platform). */
  watchlistSlots: number;
  /** CSV export of results. */
  csvExport: boolean;
  /** Public REST API requests per day / per minute. */
  apiPerDay: number | null;
  apiPerMinute: number;
  /** Max active API keys. */
  apiKeys: number;
};

export type Plan = {
  id: PlanId;
  name: string;
  /** Final copy from Prisma. */
  blurb: string;
  features: string[];
  limits: Limits;
  highlight?: boolean;
};

const FREE_LIMITS: Limits = {
  coreChecksPerDay: 100,
  fullScansPerDay: 3,
  domainChecksPerDay: 30,
  toolRunsPerDay: 2,
  bulkMaxHandles: 5,
  watchlistSlots: 0,
  csvExport: false,
  apiPerDay: 25,
  apiPerMinute: 10,
  apiKeys: 1,
};

const PRO_LIMITS: Limits = {
  coreChecksPerDay: null,
  fullScansPerDay: null,
  domainChecksPerDay: null,
  toolRunsPerDay: null,
  bulkMaxHandles: 50,
  watchlistSlots: 25,
  csvExport: true,
  apiPerDay: 5_000,
  apiPerMinute: 60,
  apiKeys: 5,
};

const TEAM_LIMITS: Limits = {
  coreChecksPerDay: null,
  fullScansPerDay: null,
  domainChecksPerDay: null,
  toolRunsPerDay: null,
  bulkMaxHandles: 200,
  watchlistSlots: 200,
  csvExport: true,
  apiPerDay: 50_000,
  apiPerMinute: 300,
  apiKeys: 20,
};

const n = (v: number | null) => (v === null ? "Unlimited" : v.toLocaleString("en-US"));

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    blurb: `For trying a name. Includes ${n(FREE_LIMITS.coreChecksPerDay)} core checks and ${n(FREE_LIMITS.fullScansPerDay)} full scans a day, plus search history.`,
    features: [
      `10 core platforms, ${n(FREE_LIMITS.coreChecksPerDay)} checks a day`,
      `${n(FREE_LIMITS.fullScansPerDay)} full scans a day (1,500+ sites)`,
      "Domain check",
      "Search history",
      `Try bulk check, variants and suggestions (${n(FREE_LIMITS.toolRunsPerDay)} runs a day)`,
      `API trial: ${n(FREE_LIMITS.apiPerDay)} requests a day`,
    ],
    limits: FREE_LIMITS,
  },
  pro: {
    id: "pro",
    name: "Pro",
    highlight: true,
    blurb:
      "For creators and brands locking down a handle. Includes unlimited scans, bulk check, variant compare, suggestions, the watchlist, CSV export and API access.",
    features: [
      "Unlimited checks and full scans",
      `Bulk check up to ${n(PRO_LIMITS.bulkMaxHandles)} handles at once`,
      "Variant compare and suggestions",
      `Watchlist: ${n(PRO_LIMITS.watchlistSlots)} handles${WATCHLIST_ALERTS_SUFFIX}`,
      "CSV export",
      `API: ${n(PRO_LIMITS.apiPerDay)} requests a day`,
    ],
    limits: PRO_LIMITS,
  },
  team: {
    id: "team",
    name: "Team",
    blurb:
      "For agencies and studios naming at volume. Everything in Pro, plus shared watchlists and higher API limits.",
    features: [
      "Everything in Pro",
      `Bulk check up to ${n(TEAM_LIMITS.bulkMaxHandles)} handles at once`,
      `Watchlist: ${n(TEAM_LIMITS.watchlistSlots)} handles${WATCHLIST_ALERTS_SUFFIX}`,
      "Shared watchlists (coming soon)",
      `API: ${n(TEAM_LIMITS.apiPerDay)} requests a day`,
    ],
    limits: TEAM_LIMITS,
  },
};

/** Visitors without an account (keyed by a salted, daily-rotating IP hash). */
export const ANON_LIMITS: Limits = {
  coreChecksPerDay: 25,
  fullScansPerDay: 2,
  domainChecksPerDay: 10,
  toolRunsPerDay: 0,
  bulkMaxHandles: 0,
  watchlistSlots: 0,
  csvExport: false,
  apiPerDay: 0,
  apiPerMinute: 0,
  apiKeys: 0,
};

export const PLAN_ORDER: PlanId[] = ["free", "pro", "team"];

export function isPlanId(v: unknown): v is PlanId {
  return v === "free" || v === "pro" || v === "team";
}

export function planPrice(id: PlanId): number | null {
  return PRICES_USD_MONTHLY[id];
}

/** "$0", "$9/mo" or "Pricing coming soon". */
export function priceLabel(id: PlanId): string {
  const p = planPrice(id);
  if (p === null) return "Pricing coming soon";
  if (p === 0) return "$0";
  return `$${p}/mo`;
}

export function metricLimit(limits: Limits, metric: Metric): number | null {
  switch (metric) {
    case "core_check":
      return limits.coreChecksPerDay;
    case "full_scan":
      return limits.fullScansPerDay;
    case "domain_check":
      return limits.domainChecksPerDay;
    case "tool_run":
      return limits.toolRunsPerDay;
    case "api":
      return limits.apiPerDay;
  }
}

export const METRIC_LABEL: Record<Metric, string> = {
  core_check: "Core checks",
  full_scan: "Full scans",
  domain_check: "Domain checks",
  tool_run: "Tool runs",
  api: "API requests",
};
