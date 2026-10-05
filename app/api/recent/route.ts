import { NextResponse } from "next/server";
import { getRecentSearches } from "@/lib/supabase/cache";

export async function GET() {
  const searches = await getRecentSearches(16);
  const seen = new Set<string>();
  const unique = [];
  for (const s of searches) {
    const key = s.username.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(s);
  }
  return NextResponse.json({ searches: unique.slice(0, 12) });
}
