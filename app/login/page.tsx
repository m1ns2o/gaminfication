import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Gamepad2, ShieldCheck } from "lucide-react";
import { getTeacherFromCookie } from "../lib/teacher-auth";

export const metadata: Metadata = {
  title: "교사용 로그인",
  description: "Google 계정으로 안전하게 로그인하세요.",
};

function safeReturnTo(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value ?? "/";
  return candidate.startsWith("/") && !candidate.startsWith("//") ? candidate : "/";
}

const oauthErrors: Record<string, string> = {
  oauth_not_configured: "Google 로그인을 사용하려면 서버의 OAuth 환경 변수를 먼저 설정해야 합니다.",
  oauth_access_denied: "Google 로그인이 취소되었습니다. 다시 시도해 주세요.",
  oauth_state_invalid: "로그인 요청이 만료되었거나 유효하지 않습니다. 처음부터 다시 시도해 주세요.",
  oauth_identity_invalid: "이메일이 확인된 Google 계정만 사용할 수 있습니다.",
  oauth_exchange_failed: "Google 인증 정보를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  oauth_provider_error: "Google 로그인 제공자에서 요청을 완료하지 못했습니다.",
  oauth_start_failed: "Google 로그인을 시작하지 못했습니다.",
  oauth_callback_failed: "Google 로그인 처리 중 문제가 발생했습니다.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ returnTo?: string | string[]; error?: string | string[] }> }) {
  const params = await searchParams;
  const returnTo = safeReturnTo(params.returnTo);
  const errorCode = Array.isArray(params.error) ? params.error[0] : params.error;
  const oauthError = errorCode ? oauthErrors[errorCode] ?? "Google 로그인을 완료하지 못했습니다." : null;
  const requestHeaders = await headers();
  const teacher = await getTeacherFromCookie(requestHeaders.get("cookie")).catch(() => null);
  if (teacher) redirect(returnTo);
  const googleSignInPath = `/api/v1/auth/google?returnTo=${encodeURIComponent(returnTo)}`;

  return (
    <main className="auth-page">
      <Link className="auth-brand" href="/" aria-label="Classloop 홈">
        <span aria-hidden="true">C</span><strong>CLASSLOOP</strong>
      </Link>
      <section className="auth-panel" aria-labelledby="teacher-login-title">
        <div className="auth-panel__intro">
          <Gamepad2 aria-hidden="true" />
          <h1 id="teacher-login-title">선생님의 게임 테이블로 돌아오세요</h1>
          <p>퀴즈 맵을 만들고, 실시간 방을 열고, 수업 결과를 한곳에서 관리합니다.</p>
          <ul>
            <li><ShieldCheck aria-hidden="true" /> Google 로그인 비밀번호는 Classloop에 전달되거나 저장되지 않습니다.</li>
            <li><ShieldCheck aria-hidden="true" /> 브라우저에는 보호된 HttpOnly 세션만 저장됩니다.</li>
          </ul>
        </div>
        <div className="teacher-auth teacher-auth--oauth">
          <div className="teacher-auth__oauth-intro">
            <strong>교사 계정으로 계속하기</strong>
            <span>학교 또는 개인 Google 계정을 사용할 수 있습니다.</span>
          </div>
          {oauthError ? <p className="teacher-auth__error teacher-auth__oauth-error" role="alert">{oauthError}</p> : null}
          <a className="google-oauth-button" href={googleSignInPath}>
            <span className="google-oauth-button__mark" aria-hidden="true">G</span>
            <span className="google-oauth-button__label--compact">Google로 계속하기</span>
            <span className="google-oauth-button__label--wide">Google 계정으로 계속하기</span>
          </a>
        </div>
      </section>
    </main>
  );
}
