import type { Metadata } from "next";
import { chatGPTSignInPath, chatGPTSignOutPath, getChatGPTUser } from "./chatgpt-auth";
import { StudioApp } from "./components/studio-app";

export const metadata: Metadata = {
  title: "나의 수업 게임",
  description: "24칸 맵을 만들고 실시간 수업 방을 시작하세요.",
};

export default async function Home() {
  const user = await getChatGPTUser();
  return <StudioApp auth={{ user, signInPath: chatGPTSignInPath("/"), signOutPath: chatGPTSignOutPath("/") }} />;
}
