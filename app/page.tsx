import type { Metadata } from "next";
import { HomeJoin } from "./components/home-join";

export const metadata: Metadata = {
  title: "게임 코드로 참가하기",
  description: "선생님이 알려준 게임 코드를 입력하고 Classloop 수업 게임에 참가하세요.",
};

export default async function Home({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const params = await searchParams;
  // QR 스캔 / 공유 링크(?code=…)로 접속하면 서버에서 코드를 읽어 자동 입력합니다.
  const initialCode = typeof params.code === "string" ? params.code.replace(/\D/g, "").slice(0, 6) : "";
  return <HomeJoin initialCode={initialCode} />;
}
