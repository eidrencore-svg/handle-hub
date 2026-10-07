"use client";

import { CORE_PLATFORMS } from "@/lib/platforms/coreList";
import { PlatformIcon } from "@/components/PlatformIcon";

export function PlatformPicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const all = value.length === CORE_PLATFORMS.length;
  return (
    <fieldset>
      <legend className="mb-2 flex w-full items-center justify-between text-sm font-medium text-slate-300">
        <span>Platforms</span>
        <button
          type="button"
          onClick={() => onChange(all ? [CORE_PLATFORMS[0].id] : CORE_PLATFORMS.map((p) => p.id))}
          className="text-xs font-medium text-accent-soft hover:text-white"
        >
          {all ? "Clear" : "Select all"}
        </button>
      </legend>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
        {CORE_PLATFORMS.map((p) => {
          const on = value.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? (value.length > 1 ? value.filter((v) => v !== p.id) : value) : [...value, p.id])}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                on ? "bg-accent/25 text-white ring-1 ring-accent/60" : "border border-white/10 bg-white/5 text-slate-400 hover:bg-white/10"
              }`}
            >
              <PlatformIcon platformId={p.id} className="h-3.5 w-3.5" />
              {p.name}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
