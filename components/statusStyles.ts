export type FilterKey = "all" | "available" | "taken" | "unknown" | "invalid";

export const FILTERS: { id: FilterKey; label: string }[] = [
  { id: "all", label: "All" },
  { id: "available", label: "Available" },
  { id: "taken", label: "Taken" },
  { id: "unknown", label: "Unknown" },
];

export function statusBadgeClasses(status: string): string {
  switch (status) {
    case "available":
      return "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30";
    case "taken":
      return "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/30";
    case "invalid":
      return "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/30";
    default:
      return "bg-slate-500/15 text-slate-300 ring-1 ring-slate-500/30";
  }
}

export function kindLabel(kind: string): string {
  return kind === "gaming" ? "Gaming" : "Social";
}
