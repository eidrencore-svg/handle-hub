import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/ssr";
import { requestOrigin } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  if (supabase) await supabase.auth.signOut().catch(() => undefined);
  revalidatePath("/", "layout");
  const base = requestOrigin(request);
  return NextResponse.redirect(`${base}/`, { status: 303 });
}
