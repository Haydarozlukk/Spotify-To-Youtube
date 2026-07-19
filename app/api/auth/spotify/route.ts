import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { setOAuthState, spotifyConfig } from "@/lib/spotify-server";

export async function GET(request: NextRequest) {
  const config = spotifyConfig();
  if (!config.configured || !config.clientId) {
    return NextResponse.redirect(new URL("/?spotify_error=not_configured", config.redirectUri));
  }
  const callbackOrigin = new URL(config.redirectUri).origin;
  const callbackHost = new URL(config.redirectUri).host;
  if (request.headers.get("host") !== callbackHost) {
    return NextResponse.redirect(new URL("/api/auth/spotify", callbackOrigin));
  }
  const state = randomBytes(32).toString("base64url");
  await setOAuthState(state);
  const authorize = new URL("https://accounts.spotify.com/authorize");
  authorize.search = new URLSearchParams({
    client_id: config.clientId,
    response_type: "code",
    redirect_uri: config.redirectUri,
    scope: "playlist-read-private user-read-private user-read-email",
    state,
    show_dialog: "true",
  }).toString();
  return NextResponse.redirect(authorize);
}
