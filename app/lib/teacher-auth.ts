import { and, eq, gt, lte } from "drizzle-orm";
import { getDb } from "../../db";
import { teacherAccounts, teacherSessions } from "../../db/schema";
export { normalizeTeacherEmail, validAuthOrigin, validTeacherEmail } from "./auth-utils";

export const TEACHER_SESSION_COOKIE = "classloop_teacher_session";
export const TEACHER_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

export type TeacherUser = {
  userId: string;
  displayName: string;
  email: string;
};

const encoder = new TextEncoder();

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

function cookieValue(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() === name) return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return null;
}

export async function createTeacherSession(teacherId: string) {
  const token = randomToken(32);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + TEACHER_SESSION_MAX_AGE_SECONDS * 1000);
  await getDb().delete(teacherSessions).where(lte(teacherSessions.expiresAt, now.toISOString()));
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
