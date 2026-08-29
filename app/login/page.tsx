import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Gamepad2, ShieldCheck } from "lucide-react";
import { TeacherAuthForm } from "../components/teacher-auth-form";
import { getTeacherFromCookie } from "../lib/teacher-auth";

export const metadata: Metadata = {
  title: "교사용 로그인",
  description: "Classloop 교사 계정으로 로그인하거나 새 계정을 만드세요.",
};

function safeReturnTo(value: string | string[] | undefined) {
  const candidate = Array.isArray(value) ? value[0] : value ?? "/";
  return candidate.startsWith("/") && !candidate.startsWith("//") ? candidate : "/";
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ returnTo?: string | string[] }> }) {
  const returnTo = safeReturnTo((await searchParams).returnTo);
  const requestHeaders = await headers();
  const teacher = await getTeacherFromCookie(requestHeaders.get("cookie")).catch(() => null);
  if (teacher) redirect(returnTo);

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
            <li><ShieldCheck aria-hidden="true" /> 비밀번호는 단방향 해시로 저장됩니다.</li>
            <li><ShieldCheck aria-hidden="true" /> 로그인 세션은 14일 후 자동 만료됩니다.</li>
          </ul>
        </div>
        <TeacherAuthForm returnTo={returnTo} />
      </section>
    </main>
  );
}
