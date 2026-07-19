import { NextRequest, NextResponse } from "next/server";
import { clearSpotifySession } from "@/lib/spotify-server";

export async function POST(request: NextRequest) {
  await clearSpotifySession(request);
  return NextResponse.json({ ok: true });
}
