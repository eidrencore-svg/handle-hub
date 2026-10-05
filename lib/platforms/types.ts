export type PlatformKind = "gaming" | "social";

export type UsernameStatus = "available" | "taken" | "unknown" | "invalid";

export interface CheckResult {
  status: UsernameStatus;
  profileUrl?: string;
  meta?: Record<string, unknown>;
}

export interface PlatformAdapter {
  id: string;
  name: string;
  kind: PlatformKind;
  checkUsername(username: string): Promise<CheckResult>;
}
