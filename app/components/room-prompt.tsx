"use client";

import { CheckCircle2, CircleHelp, Sparkles, XCircle } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import type { GameRoomState } from "../../shared/game-room";

export function RoomPrompt({
  state,
  canAnswer,
  onAnswer,
}: {
  state: GameRoomState;
  canAnswer: boolean;
  onAnswer: (answer: string) => void;
}) {
  const [answer, setAnswer] = useState("");
  const question = state.activeQuestion;
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

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!answer.trim() || !canAnswer) return;
    onAnswer(answer);
  }

  if (state.status === "FINALIZED") {
    const ranked = [...state.players].sort((left, right) => right.score - left.score || right.correctAnswers - left.correctAnswers);
    return (
      <section className="room-prompt room-results" aria-labelledby="room-results-heading">
        <div><span className="mono-label">GAME COMPLETE</span><h3 id="room-results-heading">수업 게임 결과</h3><p>문제 풀이와 점수가 안전하게 저장되었습니다.</p></div>
        <ol>{ranked.map((player, index) => <li key={player.id} className={state.winnerIds.includes(player.id) ? "is-winner" : ""}><strong>{index + 1}</strong><span><b>{player.nickname}</b><small>{player.correctAnswers}/{player.answersCount} 정답</small></span><em>{player.score}점</em></li>)}</ol>
      </section>
    );
  }

  if (question) {
    return (
      <section className="room-prompt room-prompt--question" aria-labelledby="live-question-heading">
        <div className="room-prompt__meta"><span><CircleHelp aria-hidden="true" /> 퀴즈 · {question.points}점</span><span className={remainingSeconds <= 5 ? "is-urgent" : ""}>{remainingSeconds}초</span></div>
        <h3 id="live-question-heading">{question.prompt}</h3>
        {!canAnswer && <p>현재 차례 참가자가 답을 고르고 있습니다.</p>}
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

  return null;
}
