"use client";

import { FormEvent, useState } from "react";
import { ui } from "@/components/ui/styles";

export function ExportClient({ initial, allowed }: { initial?: string; allowed: boolean }) {
  const [handle, setHandle] = useState(initial ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; url?: string; ok?: boolean } | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const h = handle.trim().replace(/^@+/, "");
    if (!h) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/tools/export?username=${encodeURIComponent(h)}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setMsg({ text: j.error ?? "Export failed.", url: j.code === "no_results" ? `/?username=${encodeURIComponent(h)}` : j.upgradeUrl });
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `handle-hub-${h}-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMsg({ text: "Downloaded.", ok: true });
    } catch {
      setMsg({ text: "Export failed. Try again." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <form onSubmit={onSubmit} className={`${ui.card} mt-4 space-y-3`}>
        <label htmlFor="ehandle" className={ui.label}>
          Handle you scanned
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="ehandle"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            placeholder="ninja"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            className={ui.input}
          />
          <button type="submit" disabled={busy || !handle.trim() || !allowed} className={`${ui.primary} shrink-0`}>
            {busy ? "Preparing…" : "Download CSV"}
          </button>
        </div>
        <p className="text-xs text-slate-500">Includes the latest result for every site checked in the last 24 hours: core platforms and the full scan.</p>
      </form>
      {msg ? (
        <div role="status" className={`${msg.ok ? ui.okBox : ui.noteBox} mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between`}>
          <span>{msg.text}</span>
          {msg.url ? (
            <a href={msg.url} className="shrink-0 font-semibold underline">
              {msg.url.startsWith("/?") ? "Run a check" : msg.url === "/pricing" ? "See plans" : "Continue"}
            </a>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
