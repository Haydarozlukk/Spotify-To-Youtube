import { NextRequest, NextResponse } from "next/server";
import { consumeGoogleOAuthState, exchangeGoogleCode, saveGoogleSession } from "@/lib/google-server";

export async function GET(request: NextRequest) {
  const home = new URL("/", request.url);
  const error = request.nextUrl.searchParams.get("error");
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  if (error) { home.searchParams.set("google_error", error); return NextResponse.redirect(home); }
  if (!code || !(await consumeGoogleOAuthState(state))) {
    home.searchParams.set("google_error", "invalid_state");
    return NextResponse.redirect(home);
  }
  try {
    const token = await exchangeGoogleCode(code);
    if (!token.refresh_token) throw new Error("Google did not return a refresh token.");
    const profileResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${token.access_token}` }, cache: "no-store",
    });
    if (!profileResponse.ok) throw new Error("Google profile could not be loaded.");
    const profile = await profileResponse.json() as { sub: string; name?: string; email?: string; picture?: string };
    const sessionId = saveGoogleSession({
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: Date.now() + token.expires_in * 1000,
      scope: token.scope,
      profile: { id: profile.sub, displayName: profile.name || "Google kullanıcısı", email: profile.email, image: profile.picture },
    });
    home.searchParams.set("google_connected", "1");
    home.hash = `google_session=${encodeURIComponent(sessionId)}`;
    return NextResponse.redirect(home);
  } catch (caught) {
    console.error("Google callback failed", caught instanceof Error ? caught.message : "unknown error");
    home.searchParams.set("google_error", "callback_failed");
    return NextResponse.redirect(home);
  }
}
