"use client";

import { FormEvent, useMemo, useState } from "react";
import { generateSuggestions, generateVariants } from "@/lib/tools/variants";
import { CORE_PLATFORM_IDS } from "@/lib/platforms/coreList";
import { ui } from "@/components/ui/styles";
import type { Viewer } from "@/lib/tools/viewer";
import { PlatformPicker } from "./PlatformPicker";
import { ToolResults } from "./ToolResults";
import { useToolRun } from "./useToolRun";
import { Gate } from "./Gate";

const DEFAULTS = {
  variants: CORE_PLATFORM_IDS,
  suggestions: ["twitch", "instagram", "tiktok", "youtube"],
};

/** Variant compare and Suggestions: generate candidates from one handle, then check them all. */
export function GeneratedToolClient({ mode, viewer }: { mode: "variants" | "suggestions"; viewer: Viewer }) {
  const [handle, setHandle] = useState("");
  const [platforms, setPlatforms] = useState<string[]>(DEFAULTS[mode]);
  const { rows, total, running, error, upgradeUrl, durationMs, run } = useToolRun();
  const candidates = useMemo(() => {
    if (!handle.trim()) return [];
    return mode === "variants" ? generateVariants(handle) : [handle.trim().replace(/^@+/, ""), ...generateSuggestions(handle)];
  }, [handle, mode]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!candidates.length || !viewer.signedIn) return;
    void run({ tool: mode, handles: candidates, platforms, base: handle.trim().replace(/^@+/, "") });
  };

  const label = mode === "variants" ? "variant compare" : "suggestions";
  return (
    <>
      <div className="mt-6 space-y-3">
        {!viewer.signedIn ? <Gate kind="login" feature={label} next={`/tools/${mode}`} /> : null}
        {viewer.plan === "free" ? (
          <Gate kind="trial" feature={mode === "variants" ? "Variant compare" : "Suggestions"} detail={`${viewer.limits.toolRunsPerDay} tool runs a day`} />
        ) : null}
      </div>
      <form onSubmit={onSubmit} className={`${ui.card} mt-4 space-y-4`}>
        <div>
          <label htmlFor="handle" className={ui.label}>
            {mode === "variants" ? "Your name" : "The name you wanted"}
          </label>
          <div className="relative">
            <span aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
              @
            </span>
            <input
              id="handle"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder={mode === "variants" ? "ninja" : "a name that's taken"}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              className={`${ui.input} pl-9`}
            />
          </div>
          {candidates.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {candidates.map((c) => (
                <span key={c} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[11px] text-slate-300">
                  {c}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <PlatformPicker value={platforms} onChange={setPlatforms} />
        <button type="submit" disabled={running || !candidates.length || !viewer.signedIn} className={`${ui.primary} w-full sm:w-auto`}>
          {running ? "Checking…" : mode === "variants" ? `Compare ${candidates.length || ""} variants` : "Find free alternatives"}
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
      <ToolResults
        order={candidates}
        rows={rows}
        total={total}
        running={running}
        durationMs={durationMs}
        csvExport={viewer.limits.csvExport}
        filename={`handle-hub-${mode}`}
        sort={mode === "suggestions" ? "availability" : "input"}
      />
    </>
  );
}
