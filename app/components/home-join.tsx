"use client";
import "../studio.css";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Gamepad2, KeyRound, Users } from "lucide-react";
import Link from "next/link";
import { useGameRoom } from "../lib/use-game-room";

type JoinRoomInfo = { gameTitle: string; playMode: "INDIVIDUAL" | "TEAM"; teamCount: number };
type JoinStatus = "idle" | "loading" | "found" | "missing" | "joining";

export function HomeJoin({ initialCode = "" }: { initialCode?: string }) {
  const realtime = useGameRoom();
  // QR 스캔 / 공유 링크(?code=…)로 접속하면 서버에서 읽은 코드로 자동 채웁니다.
  const [code, setCode] = useState(initialCode);
  const [nickname, setNickname] = useState("");
  const [roomInfo, setRoomInfo] = useState<JoinRoomInfo | null>(null);
  const [status, setStatus] = useState<JoinStatus>(initialCode.length === 6 ? "loading" : "idle");
  const [formError, setFormError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const normalizedCode = code.replace(/\D/g, "");
  const codeComplete = normalizedCode.length === 6;

  // 6자리 코드가 완성되면 방 정보 조회 (Kahoot 스타일 자동 확인)
  useEffect(() => {
    if (!codeComplete) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void fetch(`/api/v1/rooms/join?code=${normalizedCode}`, { signal: controller.signal })
        .then(async (response) => {
          const payload = await response.json() as { room?: JoinRoomInfo };
          if (!response.ok || !payload.room) throw new Error("ROOM_NOT_FOUND");
          setRoomInfo(payload.room);
          setStatus("found");
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setRoomInfo(null);
          setStatus("missing");
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [normalizedCode, codeComplete]);

  useEffect(() => {
    inputRef.current?.focus();
    // QR 링크(?code=…)로 들어온 경우 주소창에서 코드를 지워 재참가 시 혼란을 방지합니다.
    if (new URLSearchParams(window.location.search).has("code")) {
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  function handleJoin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!codeComplete) {
      setFormError("6자리 게임 코드를 입력하세요.");
      return;
    }
    if (nickname.trim().length < 2) {
      setFormError("닉네임을 2자 이상 입력하세요.");
      return;
    }
    setStatus("joining");
    setFormError(null);
    void realtime
      .joinRoom(normalizedCode, nickname.trim(), roomInfo?.playMode === "TEAM" ? 1 : undefined)
      .then(() => {
        // 참가 성공 — 학생 전용 게임 화면(/play)으로 이동
        window.location.href = "/play";
      })
      .catch((error: unknown) => {
        setFormError(error instanceof Error ? error.message : "방에 참가하지 못했습니다.");
        setStatus("idle");
      });
  }

  function handleCodeChange(value: string) {
    const next = value.replace(/\D/g, "").slice(0, 6);
    setCode(next);
    setRoomInfo(null);
    setStatus(next.length === 6 ? "loading" : "idle");
    setFormError(null);
  }

  return (
    <main className="home-join">
      <header className="home-join__brand">
        <Link href="/" className="home-join__logo" aria-label="Classloop 홈">
          <span className="home-join__logo-glyph" aria-hidden="true">C</span>
          <strong>CLASSLOOP</strong>
        </Link>
        <div className="home-join__brand-actions">
          <Link className="home-join__teacher-link" href="/studio">
            <Users aria-hidden="true" />
            교사 대시보드
          </Link>
        </div>
      </header>

      <section className="home-join__stage" aria-labelledby="home-join-title">
        <div className="home-join__hero">
          <span className="home-join__eyebrow"><Gamepad2 aria-hidden="true" /> 24칸 보드게임 수업</span>
          <h1 id="home-join-title">게임 코드로<br />수업에 참가하세요</h1>
          <p>선생님이 화면에 보여준 6자리 코드를 입력하면,<br />바로 같은 보드 위에 모입니다.</p>
        </div>

        <div className="home-join__panel" aria-label="게임 참가">
          <div className="home-join__panel-mark" aria-hidden="true">
            <KeyRound />
          </div>
          <form onSubmit={handleJoin} className="home-join__form" noValidate>
            <label className="home-join__code-field">
              <span className="sr-only">게임 코드</span>
              <input
                ref={inputRef}
                className={`home-join__code-input${codeComplete ? " is-complete" : ""}${status === "missing" ? " is-missing" : ""}`}
                inputMode="numeric"
                autoComplete="off"
                maxLength={6}
                placeholder="000000"
                aria-label="6자리 게임 코드"
                aria-describedby="join-status"
                value={code}
                onChange={(event) => handleCodeChange(event.target.value)}
              />
            </label>
            <div id="join-status" className="home-join__status" aria-live="polite">
              {status === "loading" && <span className="home-join__status-dot is-loading" aria-hidden="true" />}
              {status === "loading" ? "방 정보를 확인하고 있어요…" :
                status === "found" && roomInfo ? `📚 ${roomInfo.gameTitle} · ${roomInfo.playMode === "TEAM" ? `${roomInfo.teamCount}팀 팀전` : "개인전"}` :
                status === "missing" ? "열려 있는 방을 찾지 못했어요. 코드를 확인해 주세요." :
                "선생님이 알려준 6자리 코드를 입력하세요"}
            </div>

            {status === "found" && roomInfo && (
              <label className="home-join__nickname">
                <span>내 닉네임</span>
                <input
                  type="text"
                  value={nickname}
                  onChange={(event) => { setNickname(event.target.value); setFormError(null); }}
                  placeholder="예: 별빛나침반"
                  minLength={2}
                  maxLength={12}
                />
              </label>
            )}

            {formError && <p className="home-join__error" role="alert">{formError}</p>}

            <button
              className="home-join__submit"
              type="submit"
              disabled={status === "joining" || status !== "found"}
            >
              {status === "joining" ? "참가 중…" : "게임에 참가하기"}
              <ArrowRight aria-hidden="true" />
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
