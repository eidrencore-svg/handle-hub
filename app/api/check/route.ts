import { NextRequest, NextResponse } from "next/server";
import { checkAllPlatforms } from "@/lib/platforms";

export async function GET(request: NextRequest) {
  const username = request.nextUrl.searchParams.get("username")?.trim();

  if (!username) {
    return NextResponse.json(
      { error: "Query param `username` is required" },
      { status: 400 }
    );
  }

  if (!/^[a-zA-Z0-9._-]{2,32}$/.test(username)) {
    return NextResponse.json(
      { error: "Invalid username format" },
      { status: 400 }
    );
  }

  const payload = await checkAllPlatforms(username);
  return NextResponse.json(payload);
}
