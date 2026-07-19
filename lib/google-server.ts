import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const STATE_COOKIE = "playlistpilot_google_state";
const GOOGLE_API = "https://www.googleapis.com/youtube/v3";

export type GoogleSession = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string;
  profile: { id: string; displayName: string; email?: string; image?: string };
};

type GoogleTokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
};

declare global {
  var playlistPilotGoogleSessions: Map<string, GoogleSession> | undefined;
}

const googleSessions = globalThis.playlistPilotGoogleSessions ?? new Map<string, GoogleSession>();
globalThis.playlistPilotGoogleSessions = googleSessions;

export function googleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim() || "http://127.0.0.1:3000/api/auth/google/callback";
  return { clientId, clientSecret, redirectUri, configured: Boolean(clientId && clientSecret) };
}

function stateCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 10 * 60,
  };
}

export async function setGoogleOAuthState(state: string) {
  const store = await cookies();
  store.set(STATE_COOKIE, state, stateCookieOptions());
}

export async function consumeGoogleOAuthState(received: string | null) {
  const store = await cookies();
  const expected = store.get(STATE_COOKIE)?.value;
  store.delete(STATE_COOKIE);
  return Boolean(received && expected && received.length === expected.length && received === expected);
}

export function saveGoogleSession(session: GoogleSession) {
  const sessionId = randomBytes(32).toString("base64url");
  googleSessions.set(sessionId, session);
  return sessionId;
}

export function readGoogleSession(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const sessionId = authorization?.startsWith("Session ") ? authorization.slice(8).trim() : undefined;
  return sessionId ? googleSessions.get(sessionId) || null : null;
}

export function clearGoogleSession(request: NextRequest) {
  const authorization = request.headers.get("authorization");
  const sessionId = authorization?.startsWith("Session ") ? authorization.slice(8).trim() : undefined;
  if (sessionId) googleSessions.delete(sessionId);
}

export async function exchangeGoogleCode(code: string) {
  const config = googleConfig();
  if (!config.configured || !config.clientId || !config.clientSecret) throw new Error("Google OAuth is not configured.");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: "authorization_code",
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Google token exchange failed (${response.status}).`);
  return response.json() as Promise<GoogleTokenResponse>;
}

async function refreshGoogleSession(session: GoogleSession) {
  const config = googleConfig();
  if (!config.clientId || !config.clientSecret) throw new Error("Google OAuth is not configured.");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: session.refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Google token refresh failed (${response.status}).`);
  const token = await response.json() as GoogleTokenResponse;
  Object.assign(session, {
    accessToken: token.access_token,
    expiresAt: Date.now() + token.expires_in * 1000,
    scope: token.scope || session.scope,
  });
  return session;
}

export async function googleFetch<T>(path: string, request: NextRequest, init?: RequestInit): Promise<T> {
  const storedSession = readGoogleSession(request);
  if (!storedSession) throw new GoogleAuthError();
  let session: GoogleSession = storedSession;
  if (session.expiresAt <= Date.now() + 60_000) session = await refreshGoogleSession(session);
  const execute = () => fetch(`${GOOGLE_API}${path}`, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${session.accessToken}`, "Content-Type": "application/json" },
    cache: "no-store",
  });
  let response = await execute();
  if (response.status === 401) { session = await refreshGoogleSession(session); response = await execute(); }
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`YouTube API request failed (${response.status}): ${detail.slice(0, 180)}`);
  }
  return response.json() as Promise<T>;
}

export class GoogleAuthError extends Error {
  constructor() { super("Google account is not connected."); }
}

export function googleErrorResponse(error: unknown) {
  if (error instanceof GoogleAuthError) return NextResponse.json({ error: error.message }, { status: 401 });
  const message = error instanceof Error ? error.message : "Unexpected Google error.";
  return NextResponse.json({ error: message }, { status: 502 });
}
