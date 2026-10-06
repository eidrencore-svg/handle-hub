/** Pinned upstream catalog versions (immutable raw URLs). Bump deliberately + re-run `npm run selftest`. */
export const UPSTREAM = {
  wmn: {
    repo: "WebBreacher/WhatsMyName",
    sha: "062bcfe48df79fa618e96edc79dc9673f3fe5643",
    path: "wmn-data.json",
    license: "CC-BY-SA-4.0",
  },
  sherlock: {
    repo: "sherlock-project/sherlock",
    sha: "e40a45ec2a074b90703b3b4b842c8a3adbd6ada3",
    path: "sherlock_project/resources/data.json",
    license: "MIT",
  },
  maigret: {
    repo: "soxoj/maigret",
    sha: "d692810934c69e74acdbe24a0f464fd18eb4609b",
    path: "maigret/resources/data.json",
    license: "MIT",
  },
} as const;

export type UpstreamKey = keyof typeof UPSTREAM;

export function rawUrl(key: UpstreamKey): string {
  const u = UPSTREAM[key];
  return `https://raw.githubusercontent.com/${u.repo}/${u.sha}/${u.path}`;
}
