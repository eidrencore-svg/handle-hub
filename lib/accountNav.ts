/** Account sections, shared by the account side/tab nav and the header menu (client-safe). */
export const ACCOUNT_SECTIONS = [
  { id: "overview", href: "/account", label: "Overview" },
  { id: "watchlist", href: "/tools/watchlist", label: "Watchlist" },
  { id: "history", href: "/account/history", label: "History" },
  { id: "api-keys", href: "/account/api-keys", label: "API keys" },
  { id: "billing", href: "/account/billing", label: "Billing" },
] as const;

export type AccountSection = (typeof ACCOUNT_SECTIONS)[number]["id"];
