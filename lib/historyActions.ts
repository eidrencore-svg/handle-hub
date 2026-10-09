"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient, getCurrentUser } from "@/lib/supabase/ssr";

/** Clear the signed-in user's search history (RLS: delete own rows only). */
export async function clearHistory(): Promise<void> {
  const user = await getCurrentUser();
  const supabase = await createSupabaseServerClient();
  if (!user || !supabase) return;
  await supabase.from("search_history").delete().eq("user_id", user.id);
  revalidatePath("/account/history");
}
