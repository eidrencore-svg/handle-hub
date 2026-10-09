"use client";

import { FormEvent, useMemo, useState } from "react";
import { parseHandleList } from "@/lib/tools/variants";
import { CORE_PLATFORM_IDS } from "@/lib/platforms/coreList";
import { ui } from "@/components/ui/styles";
import type { Viewer } from "@/lib/tools/viewer";
import { PlatformPicker } from "./PlatformPicker";
import { ToolResults } from "./ToolResults";
import { useToolRun } from "./useToolRun";
import { Gate } from "./Gate";

export function BulkClient({ viewer }: { viewer: Viewer }) {
  const [text, setText] = useState("");
  const [platforms, setPlatforms] = useState<string[]>(CORE_PLATFORM_IDS);
  const { rows, total, running, error, upgradeUrl, durationMs, run } = useToolRun();
  const { handles, rejected } = useMemo(() => parseHandleList(text), [text]);
  const max = viewer.limits.bulkMaxHandles;
  const over = handles.length > max;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!handles.length || over || !viewer.signedIn) return;
    void run({ tool: "bulk", handles, platforms });
  };

  return (
    <>
      <div className="mt-6 space-y-3">
        {!viewer.signedIn ? <Gate kind="login" feature="bulk check" next="/tools/bulk" /> : null}
        {viewer.plan === "free" ? <Gate kind="trial" feature="Bulk check" detail={`${viewer.limits.toolRunsPerDay} runs a day, up to ${max} handles each`} /> : null}
      </div>
      <form onSubmit={onSubmit} className={`${ui.card} mt-4 space-y-4`}>
        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <label htmlFor="handles" className="text-sm font-medium text-slate-300">
              Handles
            </label>
            <span className={`text-xs tabular-nums ${over ? "text-rose-300" : "text-slate-500"}`}>
              {handles.length} / {max || "—"}
            </span>
          </div>
          <textarea
            id="handles"
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"one per line, or separated by commas\nninja\npokimane\nshroud"}
            spellCheck={false}
            autoCapitalize="none"
            className={ui.textarea}
          />
          {rejected.length ? (
            <p className="mt-1.5 text-xs text-orange-300">
              Skipping {rejected.length} invalid: {rejected.slice(0, 4).join(", ")}
              {rejected.length > 4 ? "…" : ""}
            </p>
          ) : null}
          {over ? (
            <p className="mt-1.5 text-xs text-rose-300">
              Your plan checks up to {max} at once.{" "}
              <a href="/pricing" className="underline">
                See plans
              </a>
            </p>
          ) : null}
        </div>
        <PlatformPicker value={platforms} onChange={setPlatforms} />
        <button type="submit" disabled={running || !handles.length || over || !viewer.signedIn} className={`${ui.primary} w-full sm:w-auto`}>
          {running ? "Checking…" : `Check ${handles.length || ""} handle${handles.length === 1 ? "" : "s"}`.replace("  ", " ")}
        </button>
      </form>
      {error ? (
        <div role="alert" className={`${ui.errorBox} mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between`}>
          <span>{error}</span>
          {upgradeUrl ? (
            <a href={upgradeUrl} className="shrink-0 font-semibold underline">
              {upgradeUrl === "/signup" ? "Create free account" : "See plans"}
            </a>
          ) : null}
        </div>
      ) : null}
      <ToolResults order={handles} rows={rows} total={total} running={running} durationMs={durationMs} csvExport={viewer.limits.csvExport} filename="handle-hub-bulk" />
    </>
  );
}
