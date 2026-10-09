"use client";

import { useActionState, useState } from "react";
import { createApiKey, type CreateKeyState } from "@/lib/apiKeys/actions";
import { ui } from "@/components/ui/styles";

/** Public host for examples: NEXT_PUBLIC_SITE_URL, else the page's own origin. */
function apiHost(): string {
  const fixed = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (fixed) return fixed;
  return typeof window !== "undefined" ? window.location.origin : "";
}

async function copyText(text: string, done: () => void) {
  try {
    await navigator.clipboard.writeText(text);
    done();
  } catch {
    /* select manually */
  }
}

export function CreateApiKeyForm({ disabled }: { disabled?: boolean }) {
  const [state, action, pending] = useActionState<CreateKeyState, FormData>(createApiKey, {});
  const [copied, setCopied] = useState<"key" | "curl" | null>(null);
  const flash = (what: "key" | "curl") => () => {
    setCopied(what);
    window.setTimeout(() => setCopied(null), 1600);
  };
  const curl = state.key ? `curl -H "Authorization: Bearer ${state.key}" \\\n  "${apiHost()}/api/v1/check?username=ninja"` : "";

  return (
    <div className="space-y-4">
      {state.key ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
          <p className="text-sm font-semibold text-emerald-200">Copy your new key now. You won&apos;t see it again.</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <code className="block min-w-0 flex-1 break-all rounded-lg bg-ink-950/70 px-3 py-2.5 font-mono text-xs text-white ring-1 ring-white/10">
              {state.key}
            </code>
            <button type="button" onClick={() => void copyText(state.key!, flash("key"))} className={`${ui.secondary} shrink-0`}>
              {copied === "key" ? "Copied" : "Copy key"}
            </button>
          </div>
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-emerald-100/80">Try it</p>
              <button
                type="button"
                onClick={() => void copyText(curl, flash("curl"))}
                className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold text-slate-200 hover:bg-white/10"
              >
                {copied === "curl" ? "Copied" : "Copy"}
              </button>
            </div>
            <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-ink-950/70 px-3 py-2.5 font-mono text-xs leading-relaxed text-slate-200 ring-1 ring-white/10">
              <code>{curl}</code>
            </pre>
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
