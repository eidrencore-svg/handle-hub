"use client";

import { useCallback, useRef, useState } from "react";

export type ToolCell = {
  platformId: string;
  platformName: string;
  status: "available" | "taken" | "unknown" | "invalid";
  reason: string | null;
  userMessage: string | null;
  profileUrl: string | null;
  checkUrl: string | null;
};
export type ToolRow = { handle: string; results: ToolCell[]; error?: string };

/** POST /api/tools/run and read the NDJSON stream into rows as they arrive. */
export function useToolRun() {
  const [rows, setRows] = useState<ToolRow[]>([]);
  const [total, setTotal] = useState(0);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgradeUrl, setUpgradeUrl] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const abort = useRef<AbortController | null>(null);

  const run = useCallback(async (input: { tool: "bulk" | "variants" | "suggestions"; handles: string[]; platforms: string[]; base?: string }) => {
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    setRows([]);
    setTotal(input.handles.length);
    setError(null);
    setUpgradeUrl(null);
    setDurationMs(null);
    setRunning(true);
    try {
      const res = await fetch("/api/tools/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        if (typeof data.upgradeUrl === "string") setUpgradeUrl(data.upgradeUrl);
        throw new Error(data.error || "The check failed. Try again.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          const msg = JSON.parse(line);
          if (msg.type === "meta") setTotal(msg.total);
          else if (msg.type === "result") setRows((prev) => [...prev, { handle: msg.handle, results: msg.results ?? [], error: msg.error }]);
          else if (msg.type === "done") setDurationMs(msg.durationMs);
        }
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message || "Something went wrong.");
    } finally {
      setRunning(false);
    }
  }, []);

  return { rows, total, running, error, upgradeUrl, durationMs, run };
}
