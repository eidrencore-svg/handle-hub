"use client";

import { useActionState, useState } from "react";
import { addWatch, type WatchState } from "@/lib/watchlist/actions";
import { ui } from "@/components/ui/styles";
import { PlatformPicker } from "./PlatformPicker";

export function WatchForm({ disabled }: { disabled?: boolean }) {
  const [state, action, pending] = useActionState<WatchState, FormData>(addWatch, {});
  const [platforms, setPlatforms] = useState<string[]>(["instagram", "tiktok", "twitch"]);
  return (
    <form action={action} className="space-y-4">
      {state.error ? <p role="alert" className={ui.errorBox}>{state.error}</p> : null}
      {state.message ? <p role="status" className={ui.okBox}>{state.message}</p> : null}
      <div>
        <label htmlFor="whandle" className={ui.label}>
          Handle you want
        </label>
        <div className="relative">
          <span aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
            @
          </span>
          <input
            id="whandle"
            name="handle"
            required
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="a name someone else has"
            className={`${ui.input} pl-9`}
            disabled={disabled}
          />
        </div>
      </div>
      <PlatformPicker value={platforms} onChange={setPlatforms} />
      {platforms.map((p) => (
        <input key={p} type="hidden" name="platforms" value={p} />
      ))}
      <button type="submit" disabled={pending || disabled} className={`${ui.primary} w-full sm:w-auto`}>
        {pending ? "Checking and adding…" : "Watch this handle"}
      </button>
    </form>
  );
}
