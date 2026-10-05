import type { CheckResult, Confidence, UsernameStatus } from "./types";

/** Stable reason codes adapters (or presenters) attach to results. */
export type CheckReason =
  | "ok"
  | "best_effort"
  | "rate_limited"
  | "needs_credentials"
  | "platform_blocked"
  | "auth_failed"
  | "network_error"
  | "timeout"
  | "unexpected_response"
  | "invalid_format";

const USER_MESSAGES: Record<CheckReason, string> = {
  ok: "",
  best_effort:
    "Based on a public profile lookup — confirm on the platform before claiming.",
  rate_limited: "Couldn't verify right now — try again shortly.",
  needs_credentials: "This platform doesn't allow automatic checks yet.",
  platform_blocked: "Check blocked by the platform.",
  auth_failed: "Couldn't verify right now — try again shortly.",
  network_error: "Couldn't reach this platform — try again shortly.",
  timeout: "Couldn't verify right now — try again shortly.",
  unexpected_response: "Couldn't verify right now — try again shortly.",
  invalid_format: "This username isn't valid on this platform.",
};

const HIGH_METHODS =
  /resolvevanity|psn_onlineids|helix_users|x_api_v2|youtube_data_api|username_attempt|gamertags_reserve|username_available/;

const MEDIUM_METHODS =
  /community_xml|twitch_gql|tiktok_oembed|x_com_profile|x_syndication|youtube_handle_page|web_profile|openxbl_search|user_about/;

export function userMessageFor(
  status: UsernameStatus,
  reason?: CheckReason
): string | undefined {
  if (!reason) return undefined;
  if (reason === "ok") return undefined;
  if (reason === "best_effort") {
    if (status === "taken" || status === "available") {
      return USER_MESSAGES.best_effort;
    }
    return USER_MESSAGES.unexpected_response;
  }
  if (reason === "invalid_format" && status === "invalid") {
    return USER_MESSAGES.invalid_format;
  }
  return USER_MESSAGES[reason] || USER_MESSAGES.unexpected_response;
}

export function isEstimate(reason?: CheckReason, confidence?: Confidence): boolean {
  if (confidence === "low" || confidence === "medium") return true;
  return reason === "best_effort";
}

export function inferConfidence(result: CheckResult): Confidence {
  if (result.confidence) return result.confidence;
  if (result.status === "invalid" || result.status === "unknown") return "low";
  const method = String(result.meta?.method ?? "").toLowerCase();
  if (HIGH_METHODS.test(method)) return "high";
  if (MEDIUM_METHODS.test(method)) return "medium";
  return "low";
}

export function inferReason(result: CheckResult): CheckReason {
  if (result.reason) return result.reason;

  if (result.status === "invalid") return "invalid_format";

  const note = String(result.meta?.note ?? result.meta?.devNote ?? "").toLowerCase();
  const method = String(result.meta?.method ?? "").toLowerCase();
  const blob = `${note} ${method}`;
  const confidence = inferConfidence(result);

  const bestEffortMethod =
    MEDIUM_METHODS.test(method) ||
    /best-effort|gql probe|html probe|oembed|community xml|@handle http/.test(note);

  if (
    (result.status === "taken" || result.status === "available") &&
    (bestEffortMethod || confidence !== "high")
  ) {
    if (HIGH_METHODS.test(method) && confidence === "high") return "ok";
    if (bestEffortMethod || confidence !== "high") return "best_effort";
  }

  if (result.status === "taken" || result.status === "available") {
    if (HIGH_METHODS.test(method)) return "ok";
    if (bestEffortMethod || /prefer |best-effort/.test(note)) return "best_effort";
    return "ok";
  }

  if (/rate.?limit|429|required login/.test(blob)) return "rate_limited";
  if (/blocked|challenged|bot\/network|network policy|captcha|login wall/.test(blob)) {
    return "platform_blocked";
  }
  if (
    /set xbox_|openxbl_api|x_bearer|steam_api|youtube_api|twitch_client|credentials|authorization expired|rejected credentials|rejected the key|lacks access|doesn't allow automatic/.test(
      blob
    ) ||
    method === "none"
  ) {
    return "needs_credentials";
  }
  if (/timed out|timeout|abort/.test(blob)) return "timeout";
  if (/failed|unexpected|http \d|missing taken|parse /.test(blob)) {
    return "unexpected_response";
  }

  return "unexpected_response";
}

export type PresentedResult = CheckResult & {
  reason: CheckReason;
  userMessage?: string;
  estimate: boolean;
  confidence: Confidence;
};

/** Normalize adapter output for the API/UI: friendly message + hidden tech notes. */
export function presentResult(result: CheckResult): PresentedResult {
  const confidence = inferConfidence(result);
  const reason = inferReason({ ...result, confidence });
  const meta = { ...(result.meta ?? {}) };
  if (typeof meta.note === "string" && !meta.devNote) {
    meta.devNote = meta.note;
  }
  delete meta.note;

  const userMessage = userMessageFor(result.status, reason);

  return {
    ...result,
    reason,
    confidence,
    estimate: isEstimate(reason, confidence),
    userMessage,
    meta,
  };
}

/** Helper for adapters to build a result without leaking tech text as `note`. */
export function makeResult(
  status: UsernameStatus,
  options: {
    reason?: CheckReason;
    confidence?: Confidence;
    profileUrl?: string;
    method?: string;
    devNote?: string;
    extra?: Record<string, unknown>;
  } = {}
): CheckResult {
  const reason =
    options.reason ??
    (status === "invalid"
      ? "invalid_format"
      : status === "unknown"
        ? "unexpected_response"
        : "ok");

  return {
    status,
    reason,
    confidence: options.confidence,
    profileUrl: options.profileUrl,
    meta: {
      ...(options.method ? { method: options.method } : {}),
      ...(options.devNote ? { devNote: options.devNote } : {}),
      ...(options.extra ?? {}),
    },
  };
}
