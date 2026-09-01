"use client";
import "../studio.css";

import { ArrowRight, BookOpen, CheckCircle2, Coffee, Flag, Gift, Zap } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import { cardEffectLabels, type GameCard, type GameQuestion } from "../lib/game-content";
import type { TileType } from "../lib/board";

export type PreviewArrivalType = TileType | "FINISH";

const demoQuestion: GameQuestion = {
  id: "test-play-question",
  gameId: "test-play",
  type: "MULTIPLE_CHOICE",
  prompt: "정조가 왕실 도서관이자 정책 연구 기관으로 설치한 곳은 어디일까요?",
  options: ["규장각", "성균관", "집현전", "홍문관"],
  correctAnswer: "규장각",
  explanation: "규장각은 정조가 왕권을 뒷받침할 인재를 기르고 정책을 연구하기 위해 설치했습니다.",
  points: 20,
  timeLimitSeconds: 30,
  answerMode: "TURN",
  orderIndex: 0,
  createdAt: "",
  updatedAt: "",
};

const demoCard: GameCard = {
  id: "test-play-card",
  gameId: "test-play",
  title: "탐구 노트 발견",
  description: "핵심 개념을 정확히 정리했습니다. 학습 점수를 얻습니다.",
  effectType: "SCORE_BONUS",
  effectValue: 10,
  orderIndex: 0,
  createdAt: "",
  updatedAt: "",
};

function normalizedAnswer(value: string) {
  return value.normalize("NFKC").trim().toLocaleLowerCase("ko-KR").replace(/\s+/g, " ");
}

function isCorrect(question: GameQuestion, answer: string) {
  const accepted = question.type === "SHORT_ANSWER"
    ? question.correctAnswer.split(",").map(normalizedAnswer)
    : [normalizedAnswer(question.correctAnswer)];
  return accepted.includes(normalizedAnswer(answer));
}

export function PreviewTileAction({
  gameId,
  type,
  canLoadContent,
  questionCount,
  cardCount,
  onEdit,
  onDismiss,
}: {
  gameId: string;
  type: PreviewArrivalType;
  canLoadContent: boolean;
  questionCount: number;
  cardCount: number;
  onEdit: (section: "questions" | "cards") => void;
  onDismiss: () => void;
}) {
  const [question, setQuestion] = useState<GameQuestion | null>(() => !canLoadContent && questionCount > 0 ? demoQuestion : null);
  const [card, setCard] = useState<GameCard | null>(() => !canLoadContent && cardCount > 0 ? demoCard : null);
  const [loading, setLoading] = useState(canLoadContent && (type === "QUIZ" || type === "BONUS" || type === "EVENT"));
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState<"correct" | "wrong" | null>(null);

  useEffect(() => {
    if (!canLoadContent || (type !== "QUIZ" && type !== "BONUS" && type !== "EVENT")) return;
    const controller = new AbortController();
    let cancelled = false;
    const path = type === "QUIZ" ? "questions" : "cards";
    void fetch(`/api/v1/games/${gameId}/${path}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("PREVIEW_CONTENT_UNAVAILABLE");
        const payload = await response.json() as { questions?: GameQuestion[]; cards?: GameCard[] };
        if (cancelled) return;
        if (type === "QUIZ") setQuestion(payload.questions?.[0] ?? null);
        else setCard(payload.cards?.[0] ?? null);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [canLoadContent, gameId, type]);

  function submit(value: string) {
    if (!question || result) return;
    setAnswer(value);
    setResult(isCorrect(question, value) ? "correct" : "wrong");
  }

  function submitShortAnswer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (answer.trim()) submit(answer);
  }

  if (type === "FINISH") {
    return (
      <section className="preview-action preview-action--finish" aria-live="polite">
        <Flag aria-hidden="true" /><div><span className="mono-label">플레이 미리보기 · 결승점</span><h3>결승점에 도착했습니다</h3><p>수업을 시작하면 이 순간 승자를 확정하고 결과를 저장합니다.</p></div><button className="button button--ink" type="button" onClick={onDismiss}>결과 확인</button>
      </section>
    );
  }

  if (type === "REST" || type === "START") {
    const Icon = type === "REST" ? Coffee : Flag;
    return (
      <section className="preview-action preview-action--rest" aria-live="polite">
        <Icon aria-hidden="true" /><div><span className="mono-label">플레이 미리보기 · {type === "REST" ? "휴식" : "출발"}</span><h3>{type === "REST" ? "휴식 칸에 도착했습니다" : "출발점으로 돌아왔습니다"}</h3><p>{type === "REST" ? "추가 행동 없이 다음 참가자에게 차례를 넘깁니다." : "순환형 보드의 한 바퀴를 마쳤습니다."}</p></div><button className="button button--quiet" type="button" onClick={onDismiss}>확인</button>
      </section>
    );
  }

  if (type === "QUIZ") {
    return (
      <section className={`preview-action preview-action--quiz${result ? ` is-${result}` : ""}`} aria-live="polite">
        <BookOpen aria-hidden="true" />
        <div className="preview-action__body">
          <span className="mono-label">플레이 미리보기 · 퀴즈</span>
          {loading ? <><h3>문제를 불러오는 중</h3><p>문제은행에서 첫 문제를 확인하고 있습니다.</p></> : question ? <><h3>{question.prompt}</h3>{result ? <div className="preview-answer-result">{result === "correct" ? <CheckCircle2 aria-hidden="true" /> : <Zap aria-hidden="true" />}<p><strong>{result === "correct" ? `정답 · +${question.points}점` : "다시 확인해 보세요"}</strong><span>정답: {question.correctAnswer}{question.explanation ? ` · ${question.explanation}` : ""}</span></p></div> : question.type === "SHORT_ANSWER" ? <form className="preview-short-answer" onSubmit={submitShortAnswer}><label><span className="sr-only">테스트 답안</span><input value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="답안을 입력하세요" autoComplete="off" /></label><button className="button button--ink" type="submit" disabled={!answer.trim()}>정답 확인</button></form> : <div className={`preview-answer-options${question.type === "OX" ? " preview-answer-options--ox" : ""}`}>{question.options.map((option, index) => <button key={`${index}-${option}`} type="button" onClick={() => submit(option)}><span>{question.type === "OX" ? option : index + 1}</span>{question.type === "OX" ? null : option}</button>)}</div>}</> : <><h3>출제할 문제가 없습니다</h3><p>표시된 문제 수는 {questionCount}개지만 저장된 문제 데이터가 없습니다. 문제은행에서 첫 문제를 만들어 주세요.</p><button className="text-button" type="button" onClick={() => onEdit("questions")}>문제은행 열기 <ArrowRight aria-hidden="true" /></button></>}
        </div>
        {result ? <button className="button button--quiet" type="button" onClick={onDismiss}>계속하기</button> : null}
      </section>
    );
  }

  const Icon = type === "BONUS" ? Gift : Zap;
  return (
    <section className={`preview-action preview-action--${type.toLowerCase()}`} aria-live="polite">
      <Icon aria-hidden="true" /><div className="preview-action__body"><span className="mono-label">플레이 미리보기 · {type === "BONUS" ? "보너스" : "이벤트"}</span>{loading ? <><h3>카드를 뽑는 중</h3><p>카드 덱을 섞고 있습니다.</p></> : card ? <><h3>{card.title}</h3><p>{card.description || "카드 효과가 즉시 적용됩니다."}</p><strong className="preview-card-effect">{cardEffectLabels[card.effectType]}{card.effectValue ? ` · ${card.effectValue}` : ""}</strong></> : <><h3>사용할 카드가 없습니다</h3><p>현재 카드 수는 {cardCount}개입니다. 카드 덱을 채우면 도착 즉시 효과가 발동합니다.</p><button className="text-button" type="button" onClick={() => onEdit("cards")}>카드 덱 열기 <ArrowRight aria-hidden="true" /></button></>}</div><button className="button button--quiet" type="button" onClick={onDismiss}>확인</button>
    </section>
  );
}
