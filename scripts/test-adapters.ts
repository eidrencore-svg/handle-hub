/**
 * Smoke-test every platform adapter against a known-taken name and a random unused name.
 * Run: npm run test:adapters
 */
import { adapters } from "../lib/platforms";

function randName() {
  return `hh${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

type Row = {
  platform: string;
  takenName: string;
  takenStatus: string;
  takenConf: string;
  takenMethod: string;
  freeName: string;
  freeStatus: string;
  freeConf: string;
  freeMethod: string;
};

async function main() {
  const takenName = "ninja";
  const freeName = randName().slice(0, 15);
  const rows: Row[] = [];

  for (const adapter of adapters) {
    const taken = await adapter.checkUsername(takenName);
    const free = await adapter.checkUsername(freeName);
    rows.push({
      platform: adapter.id,
      takenName,
      takenStatus: taken.status,
      takenConf: taken.confidence ?? "-",
      takenMethod: String(taken.meta?.method ?? "-"),
      freeName,
      freeStatus: free.status,
      freeConf: free.confidence ?? "-",
      freeMethod: String(free.meta?.method ?? "-"),
    });
  }

  const pad = (s: string, n: number) => s.padEnd(n).slice(0, n);
  console.log(
    [
      pad("platform", 12),
      pad("taken@ninja", 12),
      pad("conf", 6),
      pad("method", 22),
      pad("free", 10),
      pad("conf", 6),
      pad("method", 22),
    ].join(" | ")
  );
  console.log("-".repeat(100));
  for (const r of rows) {
    console.log(
      [
        pad(r.platform, 12),
        pad(r.takenStatus, 12),
        pad(r.takenConf, 6),
        pad(r.takenMethod, 22),
        pad(r.freeStatus, 10),
        pad(r.freeConf, 6),
        pad(r.freeMethod, 22),
      ].join(" | ")
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
