import { NextRequest, NextResponse } from "next/server";
import { clearGoogleSession } from "@/lib/google-server";

export async function POST(request: NextRequest) {
  clearGoogleSession(request);
  return NextResponse.json({ ok: true });
}
