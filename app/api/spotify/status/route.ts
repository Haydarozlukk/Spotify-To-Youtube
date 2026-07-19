import { NextRequest, NextResponse } from "next/server";
import { readSpotifySession, spotifyConfig } from "@/lib/spotify-server";

export async function GET(request: NextRequest) {
  const session = await readSpotifySession(request);
  const config = spotifyConfig();
  return NextResponse.json({
    configured: config.configured,
    connected: Boolean(session),
    profile: session?.profile || null,
  });
}
