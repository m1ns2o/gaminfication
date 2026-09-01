import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { oauthAccounts, profiles, teacherAccounts } from "../../../db/schema";
import { normalizeTeacherEmail, safeAuthReturnTo, validTeacherEmail } from "../auth-validation";
export { safeAuthReturnTo } from "../auth-validation";

const GOOGLE_AUTHORIZATION_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";
const GOOGLE_FLOW_COOKIE = "classloop_google_oauth";
const GOOGLE_CALLBACK_PATH = "/api/v1/auth/google/callback";
const GOOGLE_FLOW_MAX_AGE_SECONDS = 10 * 60;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

type OAuthFlow = {
  state: string;
  verifier: string;
  returnTo: string;
};

type GoogleTokenResponse = {
  access_token?: string;
  token_type?: string;
};

type GoogleUserInfo = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

export type GoogleTeacherIdentity = {
  teacherId: string;
  returnTo: string;
};

export class GoogleOAuthError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "GoogleOAuthError";
  }
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function randomToken(byteLength = 32) {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

async function sha256(value: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return mismatch === 0;
}

function cookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return null;
}

function encodeFlow(flow: OAuthFlow) {
  return bytesToBase64Url(encoder.encode(JSON.stringify(flow)));
}

function decodeFlow(value: string | null): OAuthFlow | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(decoder.decode(base64UrlToBytes(value))) as Partial<OAuthFlow>;
    if (typeof parsed.state !== "string" || typeof parsed.verifier !== "string" || typeof parsed.returnTo !== "string") return null;
    if (parsed.state.length > 128 || parsed.verifier.length > 128) return null;
    return { state: parsed.state, verifier: parsed.verifier, returnTo: safeAuthReturnTo(parsed.returnTo) };
  } catch {
    return null;
  }
}

function oauthConfig() {
  const clientId = env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) throw new GoogleOAuthError("oauth_not_configured");
  return { clientId, clientSecret };
}

function secureCookieSuffix(requestUrl: string) {
  return new URL(requestUrl).protocol === "https:" ? "; Secure" : "";
}

export function clearGoogleOAuthCookie(requestUrl: string) {
  return `${GOOGLE_FLOW_COOKIE}=; Path=/api/v1/auth/google; HttpOnly; SameSite=Lax; Max-Age=0${secureCookieSuffix(requestUrl)}`;
}

export async function beginGoogleOAuth(request: Request, returnToValue: string | null) {
  const { clientId } = oauthConfig();
  const state = randomToken();
  const verifier = randomToken(48);
  const challenge = bytesToBase64Url(await sha256(verifier));
  const returnTo = safeAuthReturnTo(returnToValue);
  const redirectUri = new URL(GOOGLE_CALLBACK_PATH, request.url).toString();
  const authorizationUrl = new URL(GOOGLE_AUTHORIZATION_ENDPOINT);
  authorizationUrl.search = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  const flowCookie = `${GOOGLE_FLOW_COOKIE}=${encodeURIComponent(encodeFlow({ state, verifier, returnTo }))}; Path=/api/v1/auth/google; HttpOnly; SameSite=Lax; Max-Age=${GOOGLE_FLOW_MAX_AGE_SECONDS}${secureCookieSuffix(request.url)}`;
  return { authorizationUrl: authorizationUrl.toString(), flowCookie };
}

async function exchangeAuthorizationCode(request: Request, code: string, verifier: string) {
  const { clientId, clientSecret } = oauthConfig();
  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      code_verifier: verifier,
      grant_type: "authorization_code",
      redirect_uri: new URL(GOOGLE_CALLBACK_PATH, request.url).toString(),
    }),
  });
  const token = await response.json().catch(() => null) as GoogleTokenResponse | null;
  if (!response.ok || !token?.access_token || token.token_type?.toLocaleLowerCase("en-US") !== "bearer") {
    throw new GoogleOAuthError("oauth_exchange_failed");
  }
  return token.access_token;
}

async function readGoogleUser(accessToken: string) {
  const response = await fetch(GOOGLE_USERINFO_ENDPOINT, {
    headers: { authorization: `Bearer ${accessToken}`, accept: "application/json" },
  });
  const user = await response.json().catch(() => null) as GoogleUserInfo | null;
  const email = normalizeTeacherEmail(user?.email ?? "");
  if (!response.ok || !user?.sub || user.sub.length > 255 || !user.email_verified || !validTeacherEmail(email)) {
    throw new GoogleOAuthError("oauth_identity_invalid");
  }
  return {
    subject: user.sub,
    email,
    displayName: normalizedDisplayName(user.name, email),
    avatarUrl: validAvatarUrl(user.picture),
  };
}

function normalizedDisplayName(value: string | undefined, email: string) {
  const candidate = value?.normalize("NFKC").trim().slice(0, 40) || email.split("@")[0].slice(0, 40);
  return candidate.length >= 2 ? candidate : `${candidate || "교"} 선생님`;
}

function validAvatarUrl(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

async function provisionGoogleTeacher(identity: Awaited<ReturnType<typeof readGoogleUser>>) {
  const db = getDb();
  const now = new Date().toISOString();
  const [linked] = await db
    .select({ teacherId: teacherAccounts.id })
    .from(oauthAccounts)
    .innerJoin(teacherAccounts, eq(teacherAccounts.id, oauthAccounts.teacherId))
    .where(and(eq(oauthAccounts.provider, "GOOGLE"), eq(oauthAccounts.providerSubject, identity.subject)))
    .limit(1);
  if (linked) {
    await db.update(oauthAccounts).set({ email: identity.email, updatedAt: now }).where(and(eq(oauthAccounts.provider, "GOOGLE"), eq(oauthAccounts.providerSubject, identity.subject)));
    if (identity.avatarUrl) await db.update(profiles).set({ avatarUrl: identity.avatarUrl, updatedAt: now }).where(eq(profiles.id, linked.teacherId));
    return linked.teacherId;
  }

  const [existing] = await db.select({ id: teacherAccounts.id }).from(teacherAccounts).where(eq(teacherAccounts.email, identity.email)).limit(1);
  const teacherId = existing?.id ?? crypto.randomUUID();
  if (!existing) {
    await db.insert(teacherAccounts).values({
      id: teacherId,
      email: identity.email,
      displayName: identity.displayName,
      createdAt: now,
      updatedAt: now,
    });
    await db.insert(profiles).values({
      id: teacherId,
      displayName: identity.displayName,
      avatarUrl: identity.avatarUrl,
      isAnonymous: false,
      createdAt: now,
      updatedAt: now,
    });
  } else if (identity.avatarUrl) {
    await db.update(profiles).set({ avatarUrl: identity.avatarUrl, updatedAt: now }).where(eq(profiles.id, teacherId));
  }

  try {
    await db.insert(oauthAccounts).values({
      id: crypto.randomUUID(),
      provider: "GOOGLE",
      providerSubject: identity.subject,
      teacherId,
      email: identity.email,
      createdAt: now,
      updatedAt: now,
    });
    return teacherId;
  } catch (error) {
    const [raced] = await db.select({ teacherId: oauthAccounts.teacherId }).from(oauthAccounts)
      .where(and(eq(oauthAccounts.provider, "GOOGLE"), eq(oauthAccounts.providerSubject, identity.subject))).limit(1);
    if (raced) return raced.teacherId;
    throw error;
  }
}

export async function finishGoogleOAuth(request: Request): Promise<GoogleTeacherIdentity> {
  const callback = new URL(request.url);
  const code = callback.searchParams.get("code") ?? "";
  const state = callback.searchParams.get("state") ?? "";
  const flow = decodeFlow(cookieValue(request.headers.get("cookie"), GOOGLE_FLOW_COOKIE));
  if (!flow || !state || !constantTimeEqual(flow.state, state)) throw new GoogleOAuthError("oauth_state_invalid");
  if (!code || code.length > 4096) throw new GoogleOAuthError("oauth_code_invalid");
  const accessToken = await exchangeAuthorizationCode(request, code, flow.verifier);
  const identity = await readGoogleUser(accessToken);
  return { teacherId: await provisionGoogleTeacher(identity), returnTo: flow.returnTo };
}
