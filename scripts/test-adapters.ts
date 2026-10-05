/**
 * Smoke-test every platform adapter against known-taken names and a random unused name.
 * Run: npm run test:adapters
 */
import { adapters } from "../lib/platforms";
import type { CheckResult } from "../lib/platforms/types";

function randName() {
  return `hh${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function profileKeys(r: CheckResult): string {
  const p = r.profile;
  if (!p) return "-";
  const keys = [
    p.displayName && "name",
    p.avatarUrl && "avatar",
    p.bio && "bio",
    p.followers != null && "followers",
    p.following != null && "following",
    p.posts != null && "posts",
    p.verified && "verified",
  ].filter(Boolean);
  return keys.length ? keys.join(",") : "empty";
}

async function main() {
  const takenNames = ["ninja", "mrbeast"];
  const freeName = randName().slice(0, 15);
  const pad = (s: string, n: number) => s.padEnd(n).slice(0, n);

  console.log(
    [
      pad("platform", 12),
      pad("user", 10),
      pad("status", 10),
      pad("conf", 6),
      pad("method", 24),
      "profile",
    ].join(" | ")
  );
  console.log("-".repeat(120));

  for (const adapter of adapters) {
    for (const takenName of takenNames) {
      const taken = await adapter.checkUsername(takenName);
      console.log(
        [
          pad(adapter.id, 12),
          pad(takenName, 10),
          pad(taken.status, 10),
          pad(taken.confidence ?? "-", 6),
          pad(String(taken.meta?.method ?? "-"), 24),
          profileKeys(taken),
        ].join(" | ")
      );
    }
    const free = await adapter.checkUsername(freeName);
    console.log(
      [
        pad(adapter.id, 12),
        pad(freeName.slice(0, 10), 10),
        pad(free.status, 10),
        pad(free.confidence ?? "-", 6),
        pad(String(free.meta?.method ?? "-"), 24),
        profileKeys(free),
      ].join(" | ")
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
