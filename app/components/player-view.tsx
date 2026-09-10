"use client";
import "../studio.css";

import { useState } from "react";
import { useGameRoom } from "../lib/use-game-room";
import { GameBoard } from "./game-board";
import { RoomPrompt } from "./room-prompt";

type PlayerViewProps = {
  realtime: ReturnType<typeof useGameRoom>;
  gameTitle: string;
  hiddenRoomId?: string | null;
  onDismissRoom?: (roomId: string) => void;
};

// 학생(참가자) 전용 화면 — 게임에 필요한 부분만 표시하고 편집·관리 UI는 숨김
export function PlayerView({ realtime, gameTitle, hiddenRoomId = null, onDismissRoom }: PlayerViewProps) {
  const { roomState, participantId, canRoll, canAnswer, roomCode } = realtime;
  const [boardAnimating, setBoardAnimating] = useState(false);
  if (roomState?.status === "FINALIZED" && hiddenRoomId === roomState.roomId) {
    return (
      <main className="player-view">
        <header className="player-view__bar">
          <div className="player-view__bar-left">
            <span className="player-view__logo" aria-hidden="true">C</span>
            <strong>{gameTitle}</strong>
          </div>
        </header>
        <div className="player-view__layout">
          <p className="player-roster__empty">종료된 게임입니다. 새 코드로 다시 참가하세요.</p>
        </div>
      </main>
    );
  }
  const me = roomState?.players.find((player) => player.id === participantId);
  const tokens = roomState?.players.map((player) => ({
    id: player.id,
    label: player.nickname,
    position: player.position,
    symbol: player.symbol,
    active: player.id === roomState.currentPlayerId,
  })) ?? [];
  const currentTurnLabel = roomState?.players.find((player) => player.id === roomState?.currentPlayerId)?.nickname
    ?? (roomState?.status === "FINALIZED" ? "게임 종료" : "대기 중");
  const eventLabel = roomState?.status === "FINALIZED"
    ? "최종 결과를 확인하세요"
    : roomState?.activeQuestion
      ? "퀴즈에 답할 차례"
      : roomState?.activeCard
        ? `카드 · ${roomState.activeCard.title}`
        : roomState?.lastAnswer
          ? roomState.lastAnswer.correct ? `정답 · +${roomState.lastAnswer.pointsAwarded}점` : "정답을 확인해 보세요"
          : roomState?.lastGroupResult
            ? `전원 결과 · ${roomState.lastGroupResult.correctCount}/${roomState.lastGroupResult.totalCount}명 정답`
            : roomState?.status === "LOBBY"
              ? "선생님이 게임을 시작할 때까지 기다려 주세요"
              : "퀴즈와 카드로 학습하기";

  return (
    <main className="player-view">
      <header className="player-view__bar">
        <div className="player-view__bar-left">
          <span className="player-view__logo" aria-hidden="true">C</span>
          <strong>{gameTitle}</strong>
        </div>
        {roomCode && <span className="player-view__code">방 코드 {roomCode.slice(0, 3)} {roomCode.slice(3)}</span>}
        {me && (
          <span className="player-view__me">
            <span className="player-view__me-avatar" aria-hidden="true">{me.symbol}</span>
            <span className="player-view__me-name">{me.nickname}</span>
            <span className="player-view__me-score">{me.score}점</span>
          </span>
        )}
      </header>

      <div className="player-view__layout">
        <div className="player-view__board">
          <GameBoard
            geometryId={roomState?.template ?? "LOOP_24"}
            skinId={roomState?.skin ?? "CAMPUS"}
            tokens={tokens}
            round={roomState?.round ?? 1}
            lastRoll={roomState?.lastRoll ?? 1}
            onRoll={canRoll ? () => realtime.roll() : undefined}
            currentTurnLabel={currentTurnLabel}
            eventLabel={eventLabel}
            tileTypes={roomState?.tileTypes}
            movement={roomState?.lastEvent?.from !== undefined ? {
              key: roomState?.version ?? 0,
              actorId: roomState.lastEvent.actorId,
              from: roomState.lastEvent.from,
              rollTo: roomState.lastEvent.to,
              cardDirection: roomState?.activeCard?.effectType === "MOVE_BACK" ? -1 : 1,
            } : undefined}
            onAnimationStateChange={setBoardAnimating}
          />

          {roomState && roomState.status !== "LOBBY" && !boardAnimating && (
            <div className="play-stage__overlay">
              <RoomPrompt
                key={roomState.activeQuestion?.id ?? roomState.lastEvent.type}
                state={roomState}
                canAnswer={canAnswer}
                onAnswer={realtime.answer}
                viewerId={participantId}
                onDismiss={roomState.status === "FINALIZED" && onDismissRoom ? () => onDismissRoom(roomState.roomId) : undefined}
              />
            </div>
          )}
        </div>

        <aside className="player-roster" aria-label="참가자 목록">
          <div className="player-roster__head">
            <span>참가자</span>
            <span>{roomState?.players.length ?? 0}명</span>
          </div>
          <ul className="player-roster__list">
            {roomState?.players.map((player) => (
              <li
                key={player.id}
                className={`player-roster__player${player.id === participantId ? " is-me" : ""}${player.role === "HOST" ? " is-host" : ""}${player.connected ? "" : " is-offline"}`}
              >
                <span className="player-roster__avatar" aria-hidden="true">{player.symbol}</span>
                <span className="player-roster__name">
                  {player.nickname}
                  {player.id === participantId && <em>나</em>}
                  {player.role === "HOST" && <em>교사</em>}
                </span>
                <span className="player-roster__score">{player.score}점</span>
              </li>
            ))}
            {(!roomState || roomState.players.length === 0) && (
              <li className="player-roster__empty">대기 중인 참가자가 없습니다.</li>
            )}
          </ul>
        </aside>
      </div>
    </main>
  );
}
