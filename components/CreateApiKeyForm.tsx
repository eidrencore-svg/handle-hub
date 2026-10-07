"use client";

import { useActionState, useState } from "react";
import { createApiKey, type CreateKeyState } from "@/lib/apiKeys/actions";
import { ui } from "@/components/ui/styles";

export function CreateApiKeyForm({ disabled }: { disabled?: boolean }) {
  const [state, action, pending] = useActionState<CreateKeyState, FormData>(createApiKey, {});
  const [copied, setCopied] = useState(false);

  return (
    <div className="space-y-4">
      {state.key ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <p className="text-sm font-semibold text-emerald-200">Copy your new key now. You won&apos;t see it again.</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <code className="block min-w-0 flex-1 break-all rounded-lg bg-ink-950/70 px-3 py-2.5 font-mono text-xs text-white ring-1 ring-white/10">
              {state.key}
            </code>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(state.key!);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1600);
                } catch {
                  /* select manually */
                }
              }}
              className={`${ui.secondary} shrink-0`}
            >
              {copied ? "Copied" : "Copy key"}
            </button>
          </div>
        </div>
      ) : null}
      {state.error ? (
        <p role="alert" className={ui.errorBox}>
          {state.error}
        </p>
      ) : null}
      <form action={action} className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="key-name" className="sr-only">
          Key name
        </label>
        <input id="key-name" name="name" maxLength={60} placeholder="Key name, e.g. My app" className={ui.input} disabled={disabled} />
        <button type="submit" disabled={pending || disabled} className={`${ui.primary} shrink-0`}>
          {pending ? "Creating…" : "Create key"}
        </button>
      </form>
    </div>
  );
}
