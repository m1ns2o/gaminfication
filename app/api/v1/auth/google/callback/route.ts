import { createTeacherSession, teacherSessionCookie } from "../../../../../lib/teacher-auth";
import { clearGoogleOAuthCookie, finishGoogleOAuth, GoogleOAuthError } from "../../../../../lib/google-oauth";

function loginFailure(request: Request, code: string) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("error", code);
  const headers = new Headers({
    location: loginUrl.toString(),
    "cache-control": "no-store",
  });
  headers.append("set-cookie", clearGoogleOAuthCookie(request.url));
  return new Response(null, { status: 303, headers });
}

export async function GET(request: Request) {
  const callbackUrl = new URL(request.url);
  if (callbackUrl.searchParams.has("error")) {
    return loginFailure(request, callbackUrl.searchParams.get("error") === "access_denied" ? "oauth_access_denied" : "oauth_provider_error");
  }

  try {
    const identity = await finishGoogleOAuth(request);
    const session = await createTeacherSession(identity.teacherId);
    const headers = new Headers({
      location: new URL(identity.returnTo, request.url).toString(),
      "cache-control": "no-store",
    });
    headers.append("set-cookie", teacherSessionCookie(session.token, request.url));
    headers.append("set-cookie", clearGoogleOAuthCookie(request.url));
    return new Response(null, { status: 303, headers });
  } catch (error) {
    const code = error instanceof GoogleOAuthError ? error.code : "oauth_callback_failed";
    return loginFailure(request, code);
  }
}
