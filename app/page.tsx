import type { Metadata } from "next";
import { HomeJoin } from "./components/home-join";

export const metadata: Metadata = {
  title: "게임 코드로 참가하기",
  description: "선생님이 알려준 게임 코드를 입력하고 보드런 수업 게임에 참가하세요.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "게임 코드로 참가하기 · 보드런 BoardRun",
    description: "6자리 코드를 입력하면 바로 같은 보드 위에 모입니다.",
    url: "/",
  },
};

export default async function Home({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const params = await searchParams;
  // QR 스캔 / 공유 링크(?code=…)로 접속하면 서버에서 코드를 읽어 자동 입력합니다.
  const initialCode = typeof params.code === "string" ? params.code.replace(/\D/g, "").slice(0, 6) : "";
  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: "보드런 수업 게임에 어떻게 참가하나요?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "선생님이 화면에 보여준 6자리 게임 코드를 입력하면 계정 없이 바로 같은 보드 위에 모입니다.",
        },
      },
      {
        "@type": "Question",
        name: "보드런은 어떤 수업 도구인가요?",
        acceptedAnswer: {
          "@type": "Answer",
          text: "교사가 24칸 퀴즈 보드와 문제·카드를 만들고, 학생이 코드로 참여하는 실시간 교육 보드게임 스튜디오입니다.",
        },
      },
    ],
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <HomeJoin initialCode={initialCode} />
    </>
  );
}
