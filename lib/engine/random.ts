/** Random handles for self-tests / false-positive probes. */
export function randomHandle(regexCheck?: string, len = 12): string {
  const tries: Array<() => string> = [
    () => "hh" + rand("abcdefghijklmnopqrstuvwxyz0123456789", len - 2),
    () => "hh" + rand("abcdefghijklmnopqrstuvwxyz", len - 2),
    () => "hh" + rand("abcdefghijklmnopqrstuvwxyz", 6),
  ];
  for (const t of tries) {
    const v = t();
    if (!regexCheck) return v;
    try {
      if (new RegExp(regexCheck).test(v)) return v;
    } catch {
      return v;
    }
  }
  return tries[0]();
}

function rand(alphabet: string, n: number) {
  let s = "";
  for (let i = 0; i < n; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}
