import type { Metadata } from "next";
import { headers } from "next/headers";
import { StudioApp } from "./components/studio-app";
import { getTeacherFromCookie } from "./lib/teacher-auth";

export const metadata: Metadata = {
  title: "나의 수업 게임",
  description: "24칸 맵을 만들고 실시간 수업 방을 시작하세요.",
};

export default async function Home() {
  const requestHeaders = await headers();
  const teacher = await getTeacherFromCookie(requestHeaders.get("cookie")).catch(() => null);
  const user = teacher ? { displayName: teacher.displayName, email: teacher.email } : null;
  return <StudioApp auth={{ user, signInPath: "/login?returnTo=%2F", signOutPath: "/api/v1/auth/logout" }} />;
}
