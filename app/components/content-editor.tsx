"use client";

import { CircleHelp, Plus, Sparkles, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import {
  cardEffectLabels,
  questionTypeLabels,
  type CardEffectType,
  type GameCard,
  type GameQuestion,
  type QuestionType,
  type AnswerMode,
} from "../lib/game-content";

type EditorSection = "questions" | "cards";

type QuestionDraft = {
  type: QuestionType;
  prompt: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  points: number;
  timeLimitSeconds: number;
  answerMode: AnswerMode;
};

type CardDraft = {
  title: string;
  description: string;
  effectType: CardEffectType;
  effectValue: number;
};

const emptyQuestion: QuestionDraft = {
  type: "MULTIPLE_CHOICE",
  prompt: "",
  options: ["", "", "", ""],
  correctAnswer: "",
  explanation: "",
  points: 10,
  timeLimitSeconds: 30,
  answerMode: "TURN",
};

const emptyCard: CardDraft = {
  title: "",
  description: "",
  effectType: "MOVE_FORWARD",
  effectValue: 1,
};

async function responsePayload<T>(response: Response) {
  const payload = (response.status === 204 ? {} : await response.json()) as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message ?? "요청을 처리하지 못했습니다.");
  return payload;
}

function questionDraft(question: GameQuestion): QuestionDraft {
  return {
    type: question.type,
    prompt: question.prompt,
    options: question.type === "MULTIPLE_CHOICE" ? [...question.options, "", "", "", ""].slice(0, 4) : ["", "", "", ""],
    correctAnswer: question.correctAnswer,
    explanation: question.explanation,
    points: question.points,
    timeLimitSeconds: question.timeLimitSeconds,
    answerMode: question.answerMode,
  };
}

export function ContentEditor({
  gameId,
  enabled,
  section,
  onMessage,
  onCountsChange,
}: {
  gameId: string;
  enabled: boolean;
  section: EditorSection;
  onMessage: (message: string) => void;
  onCountsChange: (questions: number, cards: number) => void;
}) {
  const [questions, setQuestions] = useState<GameQuestion[]>([]);
  const [cards, setCards] = useState<GameCard[]>([]);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [question, setQuestion] = useState<QuestionDraft>(emptyQuestion);
  const [card, setCard] = useState<CardDraft>(emptyCard);
  const [correctOptionIndex, setCorrectOptionIndex] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    Promise.all([
      fetch(`/api/v1/games/${gameId}/questions`).then((response) => responsePayload<{ questions: GameQuestion[] }>(response)),
      fetch(`/api/v1/games/${gameId}/cards`).then((response) => responsePayload<{ cards: GameCard[] }>(response)),
    ]).then(([questionPayload, cardPayload]) => {
      if (cancelled) return;
      setQuestions(questionPayload.questions);
      setCards(cardPayload.cards);
      onCountsChange(questionPayload.questions.length, cardPayload.cards.length);
      const firstQuestion = questionPayload.questions[0];
      const firstCard = cardPayload.cards[0];
      if (firstQuestion) selectQuestion(firstQuestion);
      else newQuestion();
      if (firstCard) selectCard(firstCard);
      else newCard();
    }).catch((error) => {
      if (!cancelled) onMessage(error instanceof Error ? error.message : "콘텐츠를 불러오지 못했습니다.");
    });
    return () => { cancelled = true; };
    // Callback props intentionally do not trigger content reloads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, gameId]);

  function selectQuestion(item: GameQuestion) {
    setSelectedQuestionId(item.id);
    setQuestion(questionDraft(item));
    setCorrectOptionIndex(Math.max(0, item.options.indexOf(item.correctAnswer)));
  }

  function newQuestion() {
    setSelectedQuestionId(null);
    setQuestion({ ...emptyQuestion, options: [...emptyQuestion.options] });
    setCorrectOptionIndex(0);
  }

  function selectCard(item: GameCard) {
    setSelectedCardId(item.id);
    setCard({ title: item.title, description: item.description, effectType: item.effectType, effectValue: item.effectValue || 1 });
  }

  function newCard() {
    setSelectedCardId(null);
    setCard({ ...emptyCard });
  }

  async function saveQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const body = {
        ...question,
        correctAnswer: question.type === "MULTIPLE_CHOICE" ? question.options[correctOptionIndex] : question.correctAnswer,
      };
      const response = await fetch(
        selectedQuestionId ? `/api/v1/games/${gameId}/questions/${selectedQuestionId}` : `/api/v1/games/${gameId}/questions`,
        { method: selectedQuestionId ? "PUT" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) },
      );
      const payload = await responsePayload<{ question: GameQuestion }>(response);
      const saved = payload.question;
      setQuestions((current) => selectedQuestionId
        ? current.map((item) => item.id === saved.id ? saved : item)
        : [...current, saved]);
      setSelectedQuestionId(saved.id);
      setQuestion(questionDraft(saved));
      onCountsChange(selectedQuestionId ? questions.length : questions.length + 1, cards.length);
      onMessage(`문제 ${selectedQuestionId ? "변경 내용을" : "하나를"} 저장했습니다.`);
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "문제를 저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteQuestion() {
    if (!selectedQuestionId || busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/v1/games/${gameId}/questions/${selectedQuestionId}`, { method: "DELETE" });
      await responsePayload<Record<string, never>>(response);
      const remaining = questions.filter((item) => item.id !== selectedQuestionId);
      setQuestions(remaining);
      onCountsChange(remaining.length, cards.length);
      if (remaining[0]) selectQuestion(remaining[0]);
      else newQuestion();
      onMessage("문제를 삭제했습니다.");
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "문제를 삭제하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function saveCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const response = await fetch(
        selectedCardId ? `/api/v1/games/${gameId}/cards/${selectedCardId}` : `/api/v1/games/${gameId}/cards`,
        { method: selectedCardId ? "PUT" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(card) },
      );
      const payload = await responsePayload<{ card: GameCard }>(response);
      const saved = payload.card;
      setCards((current) => selectedCardId
        ? current.map((item) => item.id === saved.id ? saved : item)
        : [...current, saved]);
      setSelectedCardId(saved.id);
      selectCard(saved);
      onCountsChange(questions.length, selectedCardId ? cards.length : cards.length + 1);
      onMessage(`카드 ${selectedCardId ? "변경 내용을" : "하나를"} 저장했습니다.`);
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "카드를 저장하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteCard() {
    if (!selectedCardId || busy) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/v1/games/${gameId}/cards/${selectedCardId}`, { method: "DELETE" });
      await responsePayload<Record<string, never>>(response);
      const remaining = cards.filter((item) => item.id !== selectedCardId);
      setCards(remaining);
      onCountsChange(questions.length, remaining.length);
      if (remaining[0]) selectCard(remaining[0]);
      else newCard();
      onMessage("카드를 삭제했습니다.");
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "카드를 삭제하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  if (!enabled) {
    return (
      <section className="question-editor content-empty" aria-labelledby="content-editor-heading">
        <h2 id="content-editor-heading">콘텐츠 편집 준비 중</h2>
        <p>게임 초안이 저장되면 문제와 카드를 만들 수 있습니다.</p>
      </section>
    );
  }

  if (section === "cards") {
    const valueRequired = card.effectType === "MOVE_FORWARD" || card.effectType === "MOVE_BACK" || card.effectType === "SCORE_BONUS";
    return (
      <section className="question-editor" aria-labelledby="content-editor-heading">
        <div className="question-editor__head">
          <div><h2 id="content-editor-heading">카드 덱</h2><p>토지나 통행료 없이 이동, 점수, 추가 기회로 수업 흐름을 바꿉니다.</p></div>
          <button className="button button--outline" type="button" onClick={newCard}><Plus /> 카드 추가</button>
        </div>
        <div className="question-workarea">
          <aside className="question-list" aria-label="카드 목록">
            {cards.length === 0 && <p className="content-empty__hint">아직 카드가 없습니다. 첫 카드를 만들어 보세요.</p>}
            {cards.map((item, index) => (
              <button key={item.id} type="button" className={item.id === selectedCardId ? "is-selected" : ""} onClick={() => selectCard(item)}>
                <span>{String(index + 1).padStart(2, "0")}</span><strong>{item.title}</strong><small>{cardEffectLabels[item.effectType]}</small>
              </button>
            ))}
          </aside>
          <form className="question-form" onSubmit={saveCard}>
            <div className="form-row form-row--split">
              <label><span>카드 이름</span><input value={card.title} onChange={(event) => setCard((current) => ({ ...current, title: event.target.value }))} placeholder="예: 집중력 보너스" required /></label>
              <label><span>효과</span><select value={card.effectType} onChange={(event) => setCard((current) => ({ ...current, effectType: event.target.value as CardEffectType }))}>{Object.entries(cardEffectLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            </div>
            {valueRequired && <label><span>{card.effectType === "SCORE_BONUS" ? "추가 점수" : "이동 칸 수"}</span><input type="number" min="1" max={card.effectType === "SCORE_BONUS" ? 100 : 12} value={card.effectValue} onChange={(event) => setCard((current) => ({ ...current, effectValue: Number(event.target.value) }))} /></label>}
            <label><span>참가자 안내</span><textarea value={card.description} onChange={(event) => setCard((current) => ({ ...current, description: event.target.value }))} placeholder="카드를 뽑았을 때 보여 줄 짧은 안내를 적어 주세요." /></label>
            <div className="answer-preview answer-preview--card"><Sparkles aria-hidden="true" /><span><strong>{card.title || "카드 미리보기"}</strong><small>{card.description || `${cardEffectLabels[card.effectType]} 효과가 적용됩니다.`}</small></span></div>
            <div className="question-form__actions">{selectedCardId && <button className="button button--danger" type="button" onClick={() => void deleteCard()} disabled={busy}><Trash2 /> 삭제</button>}<button className="button button--ink" type="submit" disabled={busy}>{busy ? "저장 중" : selectedCardId ? "변경 저장" : "카드 저장"}</button></div>
          </form>
        </div>
      </section>
    );
  }

  return (
    <section className="question-editor" aria-labelledby="content-editor-heading">
      <div className="question-editor__head">
        <div><h2 id="content-editor-heading">문제은행</h2><p>객관식·주관식·O/X 문제를 직접 만들고 정답과 해설을 함께 저장합니다.</p></div>
        <button className="button button--outline" type="button" onClick={newQuestion}><Plus /> 문제 추가</button>
      </div>
      <div className="question-workarea">
        <aside className="question-list" aria-label="문제 목록">
          {questions.length === 0 && <p className="content-empty__hint">아직 문제가 없습니다. 첫 문제를 만들어 보세요.</p>}
          {questions.map((item, index) => (
            <button key={item.id} type="button" className={item.id === selectedQuestionId ? "is-selected" : ""} onClick={() => selectQuestion(item)}>
              <span>{String(index + 1).padStart(2, "0")}</span><strong>{item.prompt}</strong><small>{questionTypeLabels[item.type]} · {item.answerMode === "ALL" ? "전원 동시" : "현재 차례"} · {item.points}점</small>
            </button>
          ))}
        </aside>
        <form className="question-form" onSubmit={saveQuestion}>
          <div className="form-row form-row--split">
            <label><span>문제 유형</span><select value={question.type} onChange={(event) => setQuestion((current) => ({ ...current, type: event.target.value as QuestionType, correctAnswer: "" }))}>{Object.entries(questionTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label><span>풀이 방식</span><select value={question.answerMode} onChange={(event) => setQuestion((current) => ({ ...current, answerMode: event.target.value as AnswerMode }))}><option value="TURN">현재 차례만</option><option value="ALL">전원 동시</option></select></label>
          </div>
          <label><span>질문</span><textarea value={question.prompt} onChange={(event) => setQuestion((current) => ({ ...current, prompt: event.target.value }))} placeholder="학습 내용을 확인할 질문을 입력하세요." required /></label>
          {question.type === "MULTIPLE_CHOICE" && (
            <fieldset className="choice-editor"><legend>보기와 정답</legend>{question.options.map((option, index) => <label key={index}><input type="radio" name="correct-option" checked={correctOptionIndex === index} onChange={() => setCorrectOptionIndex(index)} aria-label={`${index + 1}번 보기를 정답으로 선택`} /><span>{index + 1}</span><input value={option} onChange={(event) => setQuestion((current) => ({ ...current, options: current.options.map((item, itemIndex) => itemIndex === index ? event.target.value : item) }))} placeholder={`${index + 1}번 보기`} required={index < 2} /></label>)}</fieldset>
          )}
          {question.type === "SHORT_ANSWER" && <label><span>허용 정답</span><input value={question.correctAnswer} onChange={(event) => setQuestion((current) => ({ ...current, correctAnswer: event.target.value }))} placeholder="예: 규장각 (복수 정답은 쉼표로 구분)" required /></label>}
          {question.type === "OX" && <fieldset className="ox-editor"><legend>정답</legend>{["O", "X"].map((value) => <label key={value}><input type="radio" name="ox-answer" value={value} checked={question.correctAnswer === value} onChange={() => setQuestion((current) => ({ ...current, correctAnswer: value }))} /><span>{value}</span></label>)}</fieldset>}
          <div className="form-row form-row--split">
            <label><span>배점</span><input type="number" min="1" max="100" value={question.points} onChange={(event) => setQuestion((current) => ({ ...current, points: Number(event.target.value) }))} /></label>
            <label><span>제한 시간</span><select value={question.timeLimitSeconds} onChange={(event) => setQuestion((current) => ({ ...current, timeLimitSeconds: Number(event.target.value) }))}>{[10, 20, 30, 45, 60, 90, 120].map((seconds) => <option key={seconds} value={seconds}>{seconds}초</option>)}</select></label>
          </div>
          <label><span>정답 해설 (선택)</span><input value={question.explanation} onChange={(event) => setQuestion((current) => ({ ...current, explanation: event.target.value }))} placeholder="정답 공개 때 보여 줄 설명" /></label>
          <div className="answer-preview"><CircleHelp aria-hidden="true" /><span><strong>정답은 출제자와 서버만 확인합니다.</strong><small>게임 중 참가자에게는 문제와 응답 양식만 표시됩니다.</small></span></div>
          <div className="question-form__actions">{selectedQuestionId && <button className="button button--danger" type="button" onClick={() => void deleteQuestion()} disabled={busy}><Trash2 /> 삭제</button>}<button className="button button--ink" type="submit" disabled={busy}>{busy ? "저장 중" : selectedQuestionId ? "변경 저장" : "문제 저장"}</button></div>
        </form>
      </div>
    </section>
  );
}
