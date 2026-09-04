"use client";
import "../studio.css";

import { CheckCircle2, CircleHelp, Sparkles, XCircle } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import type { GameRoomState } from "../../shared/game-room";

type DetailedResponse = {
  id: string;
  questionSequence: number;
  questionPrompt: string;
  isCorrect: boolean;
  timedOut: boolean;
  responseTimeMs: number;
};

export function RoomPrompt({
  state,
  canAnswer,
  onAnswer,
  viewerId,
}: {
  state: GameRoomState;
  canAnswer: boolean;
  onAnswer: (answer: string) => void;
  viewerId: string | null;
}) {
  const [answer, setAnswer] = useState("");
  const [detailedResponses, setDetailedResponses] = useState<DetailedResponse[]>([]);
  const question = state.activeQuestion;
  const viewerIsHost = state.players.some((player) => player.id === viewerId && player.role === "HOST");
  const [remainingSeconds, setRemainingSeconds] = useState(() => state.questionDeadlineAt
    ? Math.max(0, Math.ceil((new Date(state.questionDeadlineAt).getTime() - Date.now()) / 1000))
    : 0);

  useEffect(() => {
    if (!state.questionDeadlineAt || !question) return;
    const deadline = new Date(state.questionDeadlineAt).getTime();
    const timer = window.setInterval(() => {
      setRemainingSeconds(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    }, 250);
    return () => window.clearInterval(timer);
  }, [question, state.questionDeadlineAt]);

  useEffect(() => {
    if (state.status !== "FINALIZED" || !viewerIsHost) return;
    const controller = new AbortController();
    let cancelled = false;
    async function loadResults() {
      for (let attempt = 0; attempt < 10 && !cancelled; attempt += 1) {
        const response = await fetch(`/api/v1/rooms/${state.roomId}/results`, { signal: controller.signal }).catch(() => null);
        if (response?.ok) {
          const payload = await response.json() as { responses?: DetailedResponse[] };
          if (!cancelled) setDetailedResponses(payload.responses ?? []);
          return;
        }
        await new Promise((resolve) => window.setTimeout(resolve, 200));
      }
    }
    void loadResults();
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [state.roomId, state.status, viewerIsHost]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!answer.trim() || !canAnswer) return;
    onAnswer(answer);
  }

  if (state.status === "FINALIZED") {
    const ranked = [...state.players].sort((left, right) => (
      (state.gameMode.playMode === "TEAM" ? (state.teamScores[String(right.teamNumber)] ?? 0) - (state.teamScores[String(left.teamNumber)] ?? 0) : 0)
      || right.score - left.score
      || right.correctAnswers - left.correctAnswers
    ));
    const questionSummaries = [...detailedResponses.reduce((summaries, response) => {
      const current = summaries.get(response.questionSequence) ?? { prompt: response.questionPrompt, correct: 0, total: 0, timedOut: 0, responseTimeMs: 0 };
      current.correct += response.isCorrect ? 1 : 0;
      current.total += 1;
      current.timedOut += response.timedOut ? 1 : 0;
      current.responseTimeMs += response.responseTimeMs;
      summaries.set(response.questionSequence, current);
      return summaries;
    }, new Map<number, { prompt: string; correct: number; total: number; timedOut: number; responseTimeMs: number }>()).entries()];
    return (
      <section className="room-prompt room-results" aria-labelledby="room-results-heading">
        <div><span className="mono-label">GAME COMPLETE</span><h3 id="room-results-heading">수업 게임 결과</h3><p>문제 풀이와 점수가 안전하게 저장되었습니다.</p></div>
        <ol>{ranked.map((player, index) => {
          const displayRank = state.gameMode.playMode === "TEAM"
            ? 1 + Object.values(state.teamScores).filter((score) => score > (state.teamScores[String(player.teamNumber)] ?? 0)).length
            : 1 + ranked.slice(0, index).filter((previous) => previous.score > player.score || (previous.score === player.score && previous.correctAnswers > player.correctAnswers)).length;
          return <li key={player.id} className={state.winnerIds.includes(player.id) ? "is-winner" : ""}><strong>{displayRank}</strong><span><b>{player.nickname}</b><small>{player.teamNumber ? `${player.teamNumber}팀 · ` : ""}{player.correctAnswers}/{player.answersCount} 정답</small></span><em>{player.teamNumber ? `팀 ${state.teamScores[String(player.teamNumber)] ?? 0}점` : `${player.score}점`}</em></li>;
        })}</ol>
        {viewerIsHost && <div className="room-results__details"><h4>문항별 학습 결과</h4>{questionSummaries.length === 0 ? <p>상세 응답을 정리하고 있습니다.</p> : <ul>{questionSummaries.map(([sequence, summary]) => <li key={sequence}><span><b>{summary.prompt}</b><small>{summary.correct}/{summary.total}명 정답 · 시간 초과 {summary.timedOut}명</small></span><em>평균 {(summary.responseTimeMs / summary.total / 1000).toFixed(1)}초</em></li>)}</ul>}</div>}
      </section>
    );
  }

  if (question) {
    return (
      <section className="room-prompt room-prompt--question" aria-labelledby="live-question-heading">
        <div className="room-prompt__meta"><span><CircleHelp aria-hidden="true" /> {question.answerMode === "ALL" ? `전원 동시 · ${state.submittedPlayerIds.length}/${state.expectedResponderIds.length} 제출` : "현재 차례"} · {question.points}점</span><span className={remainingSeconds <= 5 ? "is-urgent" : ""}>{remainingSeconds}초</span></div>
        <h3 id="live-question-heading">{question.prompt}</h3>
        {/* eslint-disable-next-line @next/next/no-img-element -- 플레이 화면 문제 이미지(R2 제공) */}
        {question.imageUrl ? <img className="room-prompt__image" src={question.imageUrl} alt="문제 이미지" /> : null}
        {!canAnswer && <p>{question.answerMode === "ALL" ? "답안을 제출했습니다. 다른 참가자의 제출을 기다립니다." : "현재 차례 참가자가 답을 고르고 있습니다."}</p>}
        {canAnswer && question.type === "MULTIPLE_CHOICE" && <div className="room-answer-options">{question.options.map((option, index) => <button key={`${index}-${option}`} type="button" onClick={() => onAnswer(option)}><span>{index + 1}</span>{option}</button>)}</div>}
        {canAnswer && question.type === "OX" && <div className="room-answer-options room-answer-options--ox">{["O", "X"].map((option) => <button key={option} type="button" onClick={() => onAnswer(option)}>{option}</button>)}</div>}
        {canAnswer && question.type === "SHORT_ANSWER" && <form className="room-short-answer" onSubmit={submit}><label><span className="sr-only">주관식 답안</span><input value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="정답을 입력하세요" autoComplete="off" /></label><button className="button button--ink" type="submit" disabled={!answer.trim()}>정답 제출</button></form>}
      </section>
    );
  }

  if (state.activeCard) {
    return (
      <section className="room-prompt room-prompt--card" aria-live="polite">
        <Sparkles aria-hidden="true" /><div><span>카드 효과</span><h3>{state.activeCard.title}</h3><p>{state.activeCard.description || "카드 효과가 적용되었습니다."}</p></div>
      </section>
    );
  }

  if (state.lastAnswer) {
    return (
      <section className={`room-prompt room-prompt--result ${state.lastAnswer.correct ? "is-correct" : "is-wrong"}`} aria-live="polite">
        {state.lastAnswer.correct ? <CheckCircle2 aria-hidden="true" /> : <XCircle aria-hidden="true" />}
        <div><h3>{state.lastAnswer.correct ? `정답! +${state.lastAnswer.pointsAwarded}점` : state.lastAnswer.timedOut ? "시간이 끝났어요" : "아쉬워요"}</h3><p>정답: {state.lastAnswer.correctAnswer}{state.lastAnswer.explanation ? ` · ${state.lastAnswer.explanation}` : ""}</p></div>
      </section>
    );
  }

  if (state.lastGroupResult) {
    return (
      <section className="room-prompt room-prompt--result is-correct" aria-live="polite">
        <CheckCircle2 aria-hidden="true" /><div><h3>전원 응답 결과 · {state.lastGroupResult.correctCount}/{state.lastGroupResult.totalCount} 정답</h3><p>정답: {state.lastGroupResult.correctAnswer}{state.lastGroupResult.explanation ? ` · ${state.lastGroupResult.explanation}` : ""}</p></div>
      </section>
    );
  }

  return null;
}
