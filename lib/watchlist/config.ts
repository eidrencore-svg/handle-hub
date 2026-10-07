/**
 * Watchlist email alerts: the one switch for every "alerts" promise in the UI.
 *
 * Sending isn't wired yet (see the TODO in lib/watchlist/run.ts). Once it is,
 * set RESEND_API_KEY on the server and all the copy below flips automatically.
 * Server-only: read this from server components / route handlers.
 */
export const WATCHLIST_EMAIL_ENABLED = Boolean(process.env.RESEND_API_KEY?.trim());

/** Appended to watchlist feature lines, e.g. "Watchlist: 25 handles (alerts coming soon)". */
export const WATCHLIST_ALERTS_SUFFIX = WATCHLIST_EMAIL_ENABLED ? "" : " (alerts coming soon)";

/** One-liner for the watchlist tool card, page subtitle and account overview. */
export const WATCHLIST_LINE = WATCHLIST_EMAIL_ENABLED
  ? "Get an alert when a handle you want frees up."
  : "Track the handles you want and see when they free up. Alerts coming soon.";

/** Explainer shown on the watchlist page. */
export const WATCHLIST_NOTE = WATCHLIST_EMAIL_ENABLED
  ? "We re-check watched handles every few hours and email you the moment a real check comes back Available."
  : "We re-check watched handles every few hours and flag them here the moment a real check comes back Available. Email alerts are coming soon.";
