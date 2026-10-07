"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/supabase/ssr";
import { getServiceSupabase } from "@/lib/supabase/server";
import { getAccountPlan } from "@/lib/usage";
import { PLANS } from "@/lib/plans";
import { generateApiKey } from "./index";

export type CreateKeyState = { error?: string; key?: string; name?: string };

export async function createApiKey(_prev: CreateKeyState, formData: FormData): Promise<CreateKeyState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Log in again to create a key." };
  const name = String(formData.get("name") ?? "").trim().slice(0, 60) || "Default";
  const sb = getServiceSupabase();
  if (!sb) return { error: "API keys aren't available on this server right now." };

  const plan = PLANS[await getAccountPlan(user.id, user.email)];
  const { count } = await sb
    .from("api_keys")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("revoked_at", null);
  if ((count ?? 0) >= plan.limits.apiKeys) {
    return {
      error: `${plan.name} includes ${plan.limits.apiKeys} active key${plan.limits.apiKeys === 1 ? "" : "s"}. Revoke one first${plan.id === "free" ? ", or see plans for more" : ""}.`,
    };
  }

  const { key, prefix, hash } = generateApiKey();
  const { error } = await sb.from("api_keys").insert({ user_id: user.id, name, prefix, key_hash: hash });
  if (error) return { error: "Couldn't create the key. Try again." };
  revalidatePath("/account/api-keys");
  return { key, name };
}

export async function revokeApiKey(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  const id = String(formData.get("id") ?? "");
  const sb = getServiceSupabase();
  if (!user || !sb || !/^[0-9a-f-]{36}$/i.test(id)) return;
  await sb
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id)
    .is("revoked_at", null);
  revalidatePath("/account/api-keys");
}
