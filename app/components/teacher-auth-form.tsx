"use client";

import { ArrowRight, LockKeyhole, Mail, UserRound } from "lucide-react";
import { FormEvent, useState } from "react";

type AuthMode = "login" | "register";

export function TeacherAuthForm({ returnTo }: { returnTo: string }) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const response = await fetch(`/api/v1/auth/${mode}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        displayName: form.get("displayName"),
        email: form.get("email"),
        password: form.get("password"),
      }),
    }).catch(() => null);
    const payload = response ? await response.json().catch(() => null) as { error?: { message?: string } } | null : null;
    if (!response?.ok) {
      setError(payload?.error?.message ?? "로그인 요청을 처리하지 못했습니다.");
      setBusy(false);
      return;
    }
    window.location.assign(returnTo);
  }

  function switchMode(next: AuthMode) {
    setMode(next);
    setError("");
  }

  return (
    <div className="teacher-auth">
      <div className="teacher-auth__tabs" role="tablist" aria-label="인증 방식">
        <button type="button" role="tab" aria-selected={mode === "login"} onClick={() => switchMode("login")}>로그인</button>
        <button type="button" role="tab" aria-selected={mode === "register"} onClick={() => switchMode("register")}>교사 계정 만들기</button>
      </div>
      <form className="teacher-auth__form" onSubmit={submit} aria-busy={busy}>
        {mode === "register" ? (
          <label>
            <span>표시 이름</span>
            <span className="auth-input"><UserRound aria-hidden="true" /><input name="displayName" required minLength={2} maxLength={40} autoComplete="name" placeholder="수업에서 사용할 이름" /></span>
          </label>
        ) : null}
        <label>
          <span>이메일</span>
          <span className="auth-input"><Mail aria-hidden="true" /><input name="email" type="email" required autoComplete="email" placeholder="teacher@school.kr" /></span>
        </label>
        <label>
          <span>비밀번호</span>
          <span className="auth-input"><LockKeyhole aria-hidden="true" /><input name="password" type="password" required minLength={10} maxLength={128} autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder="10자 이상 입력" /></span>
        </label>
        <p className="teacher-auth__helper">{mode === "register" ? "계정을 만들면 내 게임과 수업 결과가 이 계정에 저장됩니다." : "가입한 교사 계정으로 수업 게임 작업대를 엽니다."}</p>
        {error ? <p className="teacher-auth__error" role="alert">{error}</p> : <span className="teacher-auth__error-slot" aria-hidden="true" />}
        <button className="button button--primary button--full" type="submit" disabled={busy} data-state={busy ? "loading" : "default"}>
          {busy ? "확인 중" : mode === "login" ? "작업대 열기" : "계정 만들기"}<ArrowRight aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}
