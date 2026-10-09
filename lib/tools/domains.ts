/**
 * Domain availability via RDAP (the registries' official JSON WHOIS).
 * 200 → registered (Taken), 404 → no registration record (Available),
 * anything else or no RDAP service → unknown. Never guesses.
 */
export const DOMAIN_TLDS = ["com", "net", "io", "gg", "app", "dev"] as const;

export type DomainResult = {
  tld: string;
  domain: string;
  status: "available" | "taken" | "unknown" | "invalid";
  reason: string;
  message: string;
  actionUrl: string | null;
  source: string | null;
};

/** Registries missing from (or not yet in) the IANA bootstrap file but offering RDAP. */
const RDAP_OVERRIDES: Record<string, string> = {
  io: "https://rdap.identitydigital.services/rdap/",
};

let bootstrap: { at: number; map: Map<string, string> } | null = null;

async function rdapBase(tld: string): Promise<string | null> {
  if (RDAP_OVERRIDES[tld]) return RDAP_OVERRIDES[tld];
  if (!bootstrap || Date.now() - bootstrap.at > 24 * 3600_000) {
    try {
      const res = await fetch("https://data.iana.org/rdap/dns.json", { signal: AbortSignal.timeout(6000) });
      if (res.ok) {
        const json = (await res.json()) as { services: [string[], string[]][] };
        const map = new Map<string, string>();
        for (const [tlds, urls] of json.services) {
          const url = urls.find((u) => u.startsWith("https://")) ?? urls[0];
          for (const t of tlds) map.set(t.toLowerCase(), url.endsWith("/") ? url : `${url}/`);
        }
        bootstrap = { at: Date.now(), map };
      }
    } catch {
      /* keep the old map if any */
    }
  }
  return bootstrap?.map.get(tld) ?? null;
}

/** Domain label from a handle: lowercase, dots/underscores removed. */
export function domainLabel(handle: string): { label: string; changed: boolean; valid: boolean } {
  const lower = handle.trim().replace(/^@+/, "").toLowerCase();
  const label = lower.replace(/[._]/g, "");
  const valid = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label);
  return { label, changed: label !== lower, valid };
}

async function checkOne(label: string, tld: string): Promise<DomainResult> {
  const domain = `${label}.${tld}`;
  const manual = `https://lookup.icann.org/en/lookup?name=${encodeURIComponent(domain)}`;
  const base = await rdapBase(tld);
  if (!base) {
    return {
      tld,
      domain,
      status: "unknown",
      reason: "no_rdap",
      message: `The .${tld} registry has no public RDAP lookup, so we can't verify it. Check with a registrar.`,
      actionUrl: `https://www.namecheap.com/domains/registration/results/?domain=${encodeURIComponent(domain)}`,
      source: null,
    };
  }
  const source = new URL(base).hostname;
  try {
    const res = await fetch(`${base}domain/${encodeURIComponent(domain)}`, {
      headers: { Accept: "application/rdap+json, application/json" },
      redirect: "follow",
      signal: AbortSignal.timeout(7000),
      cache: "no-store",
    });
    if (res.status === 200) {
      return { tld, domain, status: "taken", reason: "registered", message: "Registered.", actionUrl: `https://${domain}`, source };
    }
    if (res.status === 404) {
      return {
        tld,
        domain,
        status: "available",
        reason: "no_record",
        message: "No registration record. Premium or reserved names can still be priced differently.",
        actionUrl: `https://www.namecheap.com/domains/registration/results/?domain=${encodeURIComponent(domain)}`,
        source,
      };
    }
    return {
      tld,
      domain,
      status: "unknown",
      reason: res.status === 429 ? "rate_limited" : `http_${res.status}`,
      message: res.status === 429 ? `The .${tld} registry is limiting lookups right now.` : `The .${tld} registry didn't give a clear answer.`,
      actionUrl: manual,
      source,
    };
  } catch {
    return {
      tld,
      domain,
      status: "unknown",
      reason: "network_error",
      message: `Couldn't reach the .${tld} registry.`,
      actionUrl: manual,
      source,
    };
  }
}

export async function checkDomains(handle: string): Promise<{ label: string; changed: boolean; results: DomainResult[] }> {
  const { label, changed, valid } = domainLabel(handle);
  if (!valid) {
    return {
      label,
      changed,
      results: DOMAIN_TLDS.map((tld) => ({
        tld,
        domain: `${label || handle}.${tld}`,
        status: "invalid" as const,
        reason: "invalid_label",
        message: "Domains can only use letters, numbers and hyphens (not at the start or end).",
        actionUrl: null,
        source: null,
      })),
    };
  }
  return { label, changed, results: await Promise.all(DOMAIN_TLDS.map((t) => checkOne(label, t))) };
}
