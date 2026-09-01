import { beginGoogleOAuth, GoogleOAuthError, safeAuthReturnTo } from "../../../../lib/oauth/google";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const returnTo = safeAuthReturnTo(requestUrl.searchParams.get("returnTo"));
  try {
    const oauth = await beginGoogleOAuth(request, returnTo);
    return new Response(null, {
      status: 302,
      headers: {
        location: oauth.authorizationUrl,
        "set-cookie": oauth.flowCookie,
        "cache-control": "no-store",
        "referrer-policy": "no-referrer",
      },
    });
  } catch (error) {
    const code = error instanceof GoogleOAuthError ? error.code : "oauth_start_failed";
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("returnTo", returnTo);
    loginUrl.searchParams.set("error", code);
    return Response.redirect(loginUrl, 303);
  }
}
