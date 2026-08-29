import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { profiles, teacherAccounts } from "../../../../../db/schema";
import {
  createPasswordRecord,
  createTeacherSession,
  consumeAuthRateLimit,
  normalizeTeacherEmail,
  teacherSessionCookie,
  validAuthOrigin,
  validTeacherEmail,
} from "../../../../lib/teacher-auth";

export async function POST(request: Request) {
  if (!validAuthOrigin(request)) return Response.json({ error: { code: "INVALID_ORIGIN", message: "허용되지 않은 요청입니다." } }, { status: 403 });
  const body = await request.json().catch(() => null) as { displayName?: string; email?: string; password?: string } | null;
  const displayName = body?.displayName?.normalize("NFKC").trim() ?? "";
  const email = normalizeTeacherEmail(body?.email ?? "");
  const password = body?.password ?? "";

  if (displayName.length < 2 || displayName.length > 40) {
    return Response.json({ error: { code: "DISPLAY_NAME_INVALID", message: "이름은 2~40자로 입력하세요." } }, { status: 400 });
  }
  if (!validTeacherEmail(email)) {
    return Response.json({ error: { code: "EMAIL_INVALID", message: "사용할 이메일 주소를 확인하세요." } }, { status: 400 });
  }
  if (password.length < 10 || password.length > 128) {
    return Response.json({ error: { code: "PASSWORD_INVALID", message: "비밀번호는 10~128자로 입력하세요." } }, { status: 400 });
  }
  if (!await consumeAuthRateLimit(request, email, "register")) {
    return Response.json({ error: { code: "TOO_MANY_ATTEMPTS", message: "요청이 너무 많습니다. 15분 후 다시 시도하세요." } }, { status: 429, headers: { "retry-after": "900" } });
  }

  const db = getDb();
  const [existing] = await db.select({ id: teacherAccounts.id }).from(teacherAccounts).where(eq(teacherAccounts.email, email)).limit(1);
  if (existing) {
    return Response.json({ error: { code: "EMAIL_IN_USE", message: "이미 가입된 이메일입니다." } }, { status: 409 });
  }

  const userId = crypto.randomUUID();
  const now = new Date().toISOString();
  const passwordRecord = await createPasswordRecord(password);
  await db.insert(teacherAccounts).values({ id: userId, email, displayName, ...passwordRecord, createdAt: now, updatedAt: now });
  await db.insert(profiles).values({ id: userId, displayName, isAnonymous: false, createdAt: now, updatedAt: now });
  const session = await createTeacherSession(userId);

  return Response.json(
    { user: { userId, displayName, email } },
    { status: 201, headers: { "set-cookie": teacherSessionCookie(session.token, request.url), "cache-control": "no-store" } },
  );
}
