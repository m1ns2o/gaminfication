import { safeAuthReturnTo } from "../../../../lib/auth-validation";
import { clearTeacherSessionCookie, deleteTeacherSession, validAuthOrigin } from "../../../../lib/session";

export async function POST(request: Request) {
  if (!validAuthOrigin(request)) return Response.json({ error: { code: "INVALID_ORIGIN", message: "허용되지 않은 요청입니다." } }, { status: 403 });
  await deleteTeacherSession(request.headers.get("cookie"));
  const form = await request.formData().catch(() => null);
  const returnTo = safeAuthReturnTo(String(form?.get("returnTo") ?? "/"));
  return new Response(null, {
    status: 303,
    headers: {
      location: new URL(returnTo, request.url).toString(),
      "set-cookie": clearTeacherSessionCookie(request.url),
      "cache-control": "no-store",
    },
  });
}
