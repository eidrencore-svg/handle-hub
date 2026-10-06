/** Concurrency pool with a global limit plus a per-host limit. */
export function createPool(concurrency: number, perHost = 2) {
  let active = 0;
  const hostActive = new Map<string, number>();
  const queue: Array<{ host: string; run: () => void }> = [];

  function pump() {
    for (let i = 0; i < queue.length && active < concurrency; ) {
      const job = queue[i];
      if ((hostActive.get(job.host) ?? 0) >= perHost) {
        i++;
        continue;
      }
      queue.splice(i, 1);
      job.run();
    }
  }

  return function schedule<T>(host: string, fn: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      queue.push({
        host,
        run: () => {
          active++;
          hostActive.set(host, (hostActive.get(host) ?? 0) + 1);
          fn()
            .then(resolve, reject)
            .finally(() => {
              active--;
              hostActive.set(host, (hostActive.get(host) ?? 1) - 1);
              pump();
            });
        },
      });
      pump();
    });
  };
}

export function hostOf(url: string): string {
  try {
    return new URL(url.replace(/\{u\}/g, "x")).hostname.toLowerCase();
  } catch {
    return "invalid";
  }
}
