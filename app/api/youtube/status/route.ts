import { NextRequest, NextResponse } from "next/server";
import { googleConfig, readGoogleSession } from "@/lib/google-server";

export async function GET(request: NextRequest) {
  const session = readGoogleSession(request);
  return NextResponse.json({ configured: googleConfig().configured, connected: Boolean(session), profile: session?.profile || null });
}
