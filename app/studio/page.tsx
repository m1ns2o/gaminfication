import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { StudioApp } from "../components/studio-app";
import { getTeacherFromCookie } from "../lib/session";

export const metadata: Metadata = {
  title: "교사 대시보드",
  description: "수업 게임을 만들고 실시간 방을 운영하는 교사용 작업대입니다.",
};

export default async function StudioPage() {
  const requestHeaders = await headers();
  const teacher = await getTeacherFromCookie(requestHeaders.get("cookie")).catch(() => null);
  if (!teacher) {
    redirect("/login?returnTo=%2Fstudio");
  }
  const user = { displayName: teacher.displayName, email: teacher.email };
  return <StudioApp auth={{ user, signInPath: "/login?returnTo=%2Fstudio", signOutPath: "/api/v1/auth/logout" }} />;
}
