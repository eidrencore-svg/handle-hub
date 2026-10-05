import type { CheckReason } from "./messages";
import type { ProfileInfo } from "./profile";

export type { ProfileInfo } from "./profile";

export type PlatformKind = "gaming" | "social";

export type UsernameStatus = "available" | "taken" | "unknown" | "invalid";

/** Signal strength for UI confidence badges. */
export type Confidence = "high" | "medium" | "low";

export interface CheckResult {
  status: UsernameStatus;
  profileUrl?: string;
  /** Machine-readable reason for UI messaging (see messages.ts). */
  reason?: CheckReason;
  /** high = official/signup; medium = structured page; low = heuristic. */
  confidence?: Confidence;
  /** Public profile card fields when status is taken. */
  profile?: ProfileInfo;
  meta?: Record<string, unknown>;
}

export interface PlatformAdapter {
  id: string;
  name: string;
  kind: PlatformKind;
  checkUsername(username: string): Promise<CheckResult>;
}
