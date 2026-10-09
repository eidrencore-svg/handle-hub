import type { Json } from "@/lib/supabase/types";
import { getServiceSupabase } from "@/lib/supabase/server";

export type HistorySource = "check" | "scan" | "bulk" | "variants" | "suggestions" | "domains";

/** Best-effort per-user search history (signed-in users only). */
export async function logHistory(userId: string, handle: string, source: HistorySource, summary: Record<string, unknown> = {}) {
  const sb = getServiceSupabase();
  if (!sb) return;
  try {
    await sb.from("search_history").insert({ user_id: userId, handle: handle.slice(0, 64), source, summary: summary as Json });
  } catch {
    /* best-effort */
  }
}
