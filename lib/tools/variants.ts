/** Candidate generators for the variant-compare and suggestion tools (pure, client-safe). */
export const TOOL_HANDLE_RE = /^[a-zA-Z0-9._-]{1,32}$/;

function base(raw: string): string {
  return raw.trim().replace(/^@+/, "").replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 28);
}

function finish(list: string[], max: number): string[] {
  const out: string[] = [];
  for (const c of list) {
    if (TOOL_HANDLE_RE.test(c) && !out.some((o) => o.toLowerCase() === c.toLowerCase())) out.push(c);
    if (out.length >= max) break;
  }
  return out;
}

/** name, name_, _name, name., name1, name123, xnamex, thename, namehq, realname */
export function generateVariants(raw: string, max = 10): string[] {
  const h = base(raw);
  if (!h) return [];
  return finish([h, `${h}_`, `_${h}`, `${h}.`, `${h}1`, `${h}123`, `x${h}x`, `the${h}`, `${h}hq`, `real${h}`], max);
}

/** Close alternatives for a taken name: common creator/brand prefixes and suffixes. */
export function generateSuggestions(raw: string, max = 12): string[] {
  const h = base(raw).replace(/[._-]+$/, "");
  if (!h) return [];
  const yy = String(new Date().getFullYear()).slice(2);
  return finish(
    [
      `${h}hq`,
      `the${h}`,
      `${h}tv`,
      `its${h}`,
      `${h}gg`,
      `real${h}`,
      `get${h}`,
      `${h}live`,
      `im${h}`,
      `${h}official`,
      `${h}x`,
      `${h}${yy}`,
      `hey${h}`,
      `${h}plays`,
      `${h}_`,
    ],
    max
  );
}

/** Split pasted text (newlines, commas, spaces) into unique valid handles. */
export function parseHandleList(text: string): { handles: string[]; rejected: string[] } {
  const handles: string[] = [];
  const rejected: string[] = [];
  for (const part of text.split(/[\s,;]+/)) {
    const h = part.trim().replace(/^@+/, "");
    if (!h) continue;
    if (!TOOL_HANDLE_RE.test(h)) rejected.push(h);
    else if (!handles.some((x) => x.toLowerCase() === h.toLowerCase())) handles.push(h);
  }
  return { handles, rejected };
}
