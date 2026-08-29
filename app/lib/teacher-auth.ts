import { and, eq, gt } from "drizzle-orm";
import { getDb } from "../../db";
import { requestRateLimits, teacherAccounts, teacherSessions } from "../../db/schema";

export const TEACHER_SESSION_COOKIE = "classloop_teacher_session";
export const TEACHER_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

export type TeacherUser = {
  userId: string;
  displayName: string;
  email: string;
};

const encoder = new TextEncoder();
const passwordIterations = 600_000;

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function randomToken(byteLength: number) {
  return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

async function digest(value: string) {
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value))));
}

export function validAuthOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return Boolean(origin && origin === new URL(request.url).origin);
}

export async function consumeAuthRateLimit(request: Request, email: string, action: "login" | "register") {
  const address = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const key = `teacher-auth:${action}:${await digest(`${address}:${email}`)}`;
  const db = getDb();
  const now = Date.now();
  const [record] = await db.select().from(requestRateLimits).where(eq(requestRateLimits.key, key)).limit(1);
  if (!record || new Date(record.expiresAt).getTime() <= now) {
    if (record) await db.delete(requestRateLimits).where(eq(requestRateLimits.key, key));
    await db.insert(requestRateLimits).values({ key, count: 1, expiresAt: new Date(now + 15 * 60 * 1000).toISOString() });
    return true;
  }
  if (record.count >= 8) return false;
  await db.update(requestRateLimits).set({ count: record.count + 1 }).where(eq(requestRateLimits.key, key));
  return true;
}

async function derivePassword(password: string, salt: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: encoder.encode(salt), iterations: passwordIterations },
    key,
    256,
  );
  return bytesToBase64Url(new Uint8Array(bits));
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

export function normalizeTeacherEmail(value: string) {
  return value.normalize("NFKC").trim().toLocaleLowerCase("en-US");
}

export function validTeacherEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

export async function createPasswordRecord(password: string) {
  const salt = randomToken(18);
  return { passwordSalt: salt, passwordHash: await derivePassword(password, salt) };
}

export async function verifyTeacherPassword(password: string, passwordSalt: string, passwordHash: string) {
  return constantTimeEqual(await derivePassword(password, passwordSalt), passwordHash);
}

export async function createTeacherSession(teacherId: string) {
  const token = randomToken(32);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TEACHER_SESSION_MAX_AGE_SECONDS * 1000);
  await getDb().insert(teacherSessions).values({
    tokenHash: await digest(token),
    teacherId,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  });
  return { token, expiresAt };
}

export async function deleteTeacherSession(cookieHeader: string | null) {
  const token = cookieValue(cookieHeader, TEACHER_SESSION_COOKIE);
  if (token) await getDb().delete(teacherSessions).where(eq(teacherSessions.tokenHash, await digest(token)));
}

export async function getTeacherFromCookie(cookieHeader: string | null): Promise<TeacherUser | null> {
  const token = cookieValue(cookieHeader, TEACHER_SESSION_COOKIE);
  if (!token) return null;
  const now = new Date().toISOString();
  const [row] = await getDb()
    .select({
      userId: teacherAccounts.id,
      displayName: teacherAccounts.displayName,
      email: teacherAccounts.email,
    })
    .from(teacherSessions)
    .innerJoin(teacherAccounts, eq(teacherAccounts.id, teacherSessions.teacherId))
    .where(and(eq(teacherSessions.tokenHash, await digest(token)), gt(teacherSessions.expiresAt, now)))
    .limit(1);
  return row ?? null;
}

export function teacherSessionCookie(token: string, requestUrl: string) {
  const secure = new URL(requestUrl).protocol === "https:" ? "; Secure" : "";
  return `${TEACHER_SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${TEACHER_SESSION_MAX_AGE_SECONDS}${secure}`;
}

export function clearTeacherSessionCookie(requestUrl: string) {
  const secure = new URL(requestUrl).protocol === "https:" ? "; Secure" : "";
  return `${TEACHER_SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}
