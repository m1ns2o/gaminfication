import type { Metadata } from "next";
import { headers } from "next/headers";
import { Bricolage_Grotesque, Geist_Mono, Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import "./studio.css";

const korean = Noto_Sans_KR({
  variable: "--font-korean",
  subsets: ["latin"],
  display: "swap",
});

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const metadataBase = new URL(`${protocol}://${host}`);

  return {
    metadataBase,
    title: {
      default: "Classloop · 수업이 보드게임이 되는 곳",
      template: "%s · Classloop",
    },
    description: "교사가 만들고, 학생이 코드로 참여하는 실시간 교육 보드게임 스튜디오입니다.",
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      title: "Classloop · 수업이 보드게임이 되는 곳",
      description: "24칸 맵을 만들고, 코드로 모여, 한 수업을 함께 완주하세요.",
      images: [{ url: new URL("/og.png", metadataBase).toString(), width: 1730, height: 909, alt: "Classloop 24칸 교육 보드게임" }],
      type: "website",
      locale: "ko_KR",
    },
    twitter: {
      card: "summary_large_image",
      title: "Classloop · 수업이 보드게임이 되는 곳",
      description: "교사가 만들고 학생이 코드로 참여하는 실시간 교육 보드게임 스튜디오",
      images: [new URL("/og.png", metadataBase).toString()],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${korean.variable} ${bricolage.variable} ${geistMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
