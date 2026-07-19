import { NextRequest, NextResponse } from "next/server";
import { consumeOAuthState, exchangeSpotifyCode, saveSpotifySession } from "@/lib/spotify-server";

export async function GET(request: NextRequest) {
  const home = new URL("/", request.url);
  const error = request.nextUrl.searchParams.get("error");
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  if (error) { home.searchParams.set("spotify_error", error); return NextResponse.redirect(home); }
  if (!code || !(await consumeOAuthState(state))) {
    home.searchParams.set("spotify_error", "invalid_state");
    return NextResponse.redirect(home);
  }
  try {
    const token = await exchangeSpotifyCode(code);
    if (!token.refresh_token) throw new Error("Spotify did not return a refresh token.");
    const profileResponse = await fetch("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${token.access_token}` }, cache: "no-store",
    });
    if (!profileResponse.ok) throw new Error("Spotify profile could not be loaded.");
    const profile = await profileResponse.json() as { account_id?: string; id: string; display_name?: string; email?: string; images?: Array<{ url: string }> };
    const redirectResponse = NextResponse.redirect(home);
    const sessionId = await saveSpotifySession({
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresAt: Date.now() + token.expires_in * 1000,
      scope: token.scope,
      profile: {
        accountId: profile.account_id || profile.id,
        displayName: profile.display_name || "Spotify kullanıcısı",
        email: profile.email,
        image: profile.images?.[0]?.url,
      },
    }, redirectResponse);
    home.searchParams.set("spotify_connected", "1");
    home.hash = `spotify_session=${encodeURIComponent(sessionId)}`;
    redirectResponse.headers.set("location", home.toString());
    return redirectResponse;
  } catch (caught) {
    console.error("Spotify callback failed", caught instanceof Error ? caught.message : "unknown error");
    home.searchParams.set("spotify_error", "callback_failed");
    return NextResponse.redirect(home);
  }
}
