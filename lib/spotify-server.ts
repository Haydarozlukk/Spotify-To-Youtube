import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "playlistpilot_sid";
const STATE_COOKIE = "playlistpilot_spotify_state";
const SPOTIFY_API = "https://api.spotify.com/v1";

export type SpotifySession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string;
  profile: { accountId: string; displayName: string; email?: string; image?: string };
};

type SpotifyTokenResponse = {
  access_token: string;
  token_type: string;
  scope: string;
  expires_in: number;
  refresh_token?: string;
};

declare global {
  var playlistPilotSpotifySessions: Map<string, SpotifySession> | undefined;
}

const spotifySessions = globalThis.playlistPilotSpotifySessions ?? new Map<string, SpotifySession>();
globalThis.playlistPilotSpotifySessions = spotifySessions;

export function spotifyConfig() {
  const clientId = process.env.SPOTIFY_CLIENT_ID?.trim();
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET?.trim();
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI?.trim() || "http://127.0.0.1:3000/api/auth/spotify/callback";
  const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY?.trim();
  return { clientId, clientSecret, redirectUri, encryptionKey, configured: Boolean(clientId && clientSecret && encryptionKey) };
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

export async function setOAuthState(state: string) {
  const store = await cookies();
  store.set(STATE_COOKIE, state, cookieOptions(10 * 60));
}

export async function consumeOAuthState(received: string | null) {
  const store = await cookies();
  const expected = store.get(STATE_COOKIE)?.value;
  store.delete(STATE_COOKIE);
  return Boolean(received && expected && received.length === expected.length && received === expected);
}

export async function saveSpotifySession(session: SpotifySession, response?: NextResponse) {
  const requestCookies = await cookies();
  const sessionId = requestCookies.get(SESSION_COOKIE)?.value || randomBytes(32).toString("base64url");
  spotifySessions.set(sessionId, session);
  requestCookies.set(SESSION_COOKIE, sessionId, cookieOptions(30 * 24 * 60 * 60));
  if (response) response.cookies.set(SESSION_COOKIE, sessionId, cookieOptions(30 * 24 * 60 * 60));
  return sessionId;
}

export async function clearSpotifySession(request?: NextRequest) {
  const store = await cookies();
  const authorization = request?.headers.get("authorization");
  const headerSessionId = authorization?.startsWith("Session ") ? authorization.slice(8).trim() : undefined;
  const sessionId = headerSessionId || store.get(SESSION_COOKIE)?.value;
  if (sessionId) spotifySessions.delete(sessionId);
  store.delete(SESSION_COOKIE);
}

export async function readSpotifySession(request?: NextRequest): Promise<SpotifySession | null> {
  const store = await cookies();
  const authorization = request?.headers.get("authorization");
  const headerSessionId = authorization?.startsWith("Session ") ? authorization.slice(8).trim() : undefined;
  const sessionId = headerSessionId || store.get(SESSION_COOKIE)?.value;
  const session = sessionId ? spotifySessions.get(sessionId) : undefined;
  return session || null;
}

export async function exchangeSpotifyCode(code: string) {
  const config = spotifyConfig();
  if (!config.configured || !config.clientId || !config.clientSecret) throw new Error("Spotify is not configured.");
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ code, redirect_uri: config.redirectUri, grant_type: "authorization_code" }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Spotify token exchange failed (${response.status}).`);
  return response.json() as Promise<SpotifyTokenResponse>;
}

async function refreshSpotifySession(session: SpotifySession) {
  const config = spotifyConfig();
  if (!config.clientId || !config.clientSecret) throw new Error("Spotify is not configured.");
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: session.refreshToken }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Spotify token refresh failed (${response.status}).`);
  const token = await response.json() as SpotifyTokenResponse;
  const refreshed: SpotifySession = {
    ...session,
    accessToken: token.access_token,
    refreshToken: token.refresh_token || session.refreshToken,
    expiresAt: Date.now() + token.expires_in * 1000,
    scope: token.scope || session.scope,
  };
  Object.assign(session, refreshed);
  return session;
}

export async function spotifyFetch<T>(path: string, request?: NextRequest): Promise<T> {
  let session = await readSpotifySession(request);
  if (!session) throw new SpotifyAuthError();
  if (session.expiresAt <= Date.now() + 60_000) session = await refreshSpotifySession(session);
  let response = await fetch(`${SPOTIFY_API}${path}`, { headers: { Authorization: `Bearer ${session.accessToken}` }, cache: "no-store" });
  if (response.status === 401) {
    session = await refreshSpotifySession(session);
    response = await fetch(`${SPOTIFY_API}${path}`, { headers: { Authorization: `Bearer ${session.accessToken}` }, cache: "no-store" });
  }
  if (!response.ok) throw new Error(`Spotify API request failed (${response.status}).`);
  return response.json() as Promise<T>;
}

export class SpotifyAuthError extends Error {
  constructor() { super("Spotify account is not connected."); }
}

export function spotifyErrorResponse(error: unknown) {
  if (error instanceof SpotifyAuthError) return NextResponse.json({ error: error.message }, { status: 401 });
  const message = error instanceof Error ? error.message : "Unexpected Spotify error.";
  return NextResponse.json({ error: message }, { status: 502 });
}
