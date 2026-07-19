import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { googleConfig, setGoogleOAuthState } from "@/lib/google-server";

export async function GET(request: NextRequest) {
  const config = googleConfig();
  if (!config.configured || !config.clientId) return NextResponse.redirect(new URL("/?google_error=not_configured", config.redirectUri));
  const callbackOrigin = new URL(config.redirectUri).origin;
  const callbackHost = new URL(config.redirectUri).host;
  if (request.headers.get("host") !== callbackHost) return NextResponse.redirect(new URL("/api/auth/google", callbackOrigin));

  const state = randomBytes(32).toString("base64url");
  await setGoogleOAuthState(state);
  const authorize = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  authorize.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: "code",
    scope: "openid email profile https://www.googleapis.com/auth/youtube.force-ssl",
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent select_account",
    state,
  }).toString();
  return NextResponse.redirect(authorize);
}
