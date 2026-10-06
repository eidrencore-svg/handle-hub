import { NextResponse } from "next/server";
import { getRecentSearches } from "@/lib/supabase/repo";

export const dynamic = "force-dynamic";

export async function GET() {
  const searches = await getRecentSearches(12);
  return NextResponse.json({ searches });
}
