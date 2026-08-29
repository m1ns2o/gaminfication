import { eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { teacherAccounts } from "../../../../../db/schema";
import {
  createTeacherSession,
  consumeAuthRateLimit,
  normalizeTeacherEmail,
  teacherSessionCookie,
  validAuthOrigin,
  verifyTeacherPassword,
} from "../../../../lib/teacher-auth";

export async function POST(request: Request) {
  if (!validAuthOrigin(request)) return Response.json({ error: { code: "INVALID_ORIGIN", message: "허용되지 않은 요청입니다." } }, { status: 403 });
  const body = await request.json().catch(() => null) as { email?: string; password?: string } | null;
  const email = normalizeTeacherEmail(body?.email ?? "");
  const password = body?.password ?? "";
  if (!await consumeAuthRateLimit(request, email, "login")) {
    return Response.json({ error: { code: "TOO_MANY_ATTEMPTS", message: "로그인 시도가 너무 많습니다. 15분 후 다시 시도하세요." } }, { status: 429, headers: { "retry-after": "900" } });
  }
  const [account] = await getDb().select().from(teacherAccounts).where(eq(teacherAccounts.email, email)).limit(1);
  const validHash = await verifyTeacherPassword(
    password,
    account?.passwordSalt ?? "classloop-invalid-account-salt",
    account?.passwordHash ?? "classloop-invalid-account-hash",
  );
  const valid = Boolean(account && validHash);

  if (!account || !valid) {
    return Response.json(
      { error: { code: "INVALID_CREDENTIALS", message: "이메일 또는 비밀번호가 올바르지 않습니다." } },
      { status: 401, headers: { "cache-control": "no-store" } },
    );
  }

  const session = await createTeacherSession(account.id);
  return Response.json(
    { user: { userId: account.id, displayName: account.displayName, email: account.email } },
    { headers: { "set-cookie": teacherSessionCookie(session.token, request.url), "cache-control": "no-store" } },
  );
}
