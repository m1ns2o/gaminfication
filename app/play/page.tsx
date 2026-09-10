import type { Metadata } from "next";
import { StudioApp } from "../components/studio-app";

export const metadata: Metadata = {
  title: "게임 참가 · 보드런 BoardRun",
  description: "참가 코드로 입장한 수업 게임 화면입니다.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function PlayPage() {
  // 학생 전용 화면 — 로그인 없이 참가 코드로 입장한 사용자만 볼 수 있습니다.
  // StudioApp은 isPlayer(참가자) 상태일 때 게임 보드 + 참가자 목록만 렌더링합니다.
  return (
    <StudioApp
      auth={{
        user: null,
        signInPath: "/login?returnTo=%2Fstudio",
        signOutPath: "/api/v1/auth/logout",
      }}
    />
  );
}
