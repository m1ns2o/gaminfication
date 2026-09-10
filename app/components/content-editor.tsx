"use client";
import "../studio.css";

import { BookOpen, CircleHelp, Clock3, Coffee, Flag, Gift, Grid2X2, ImagePlus, Sparkles, Trash2, Users, Zap } from "lucide-react";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import {
  cardEffectLabels,
  questionTypeLabels,
  type CardEffectType,
  type GameCard,
  type GameQuestion,
  type QuestionType,
  type AnswerMode,
} from "../lib/game-content";
import { tileTypeLabels, type TileType } from "../lib/board";
import type { BoardTileMark } from "./game-board";
import { SelectMenu } from "./select-menu";

type ContentKind = "questions" | "cards";

type QuestionDraft = {
  type: QuestionType;
  prompt: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  points: number;
  timeLimitSeconds: number;
  answerMode: AnswerMode;
  imageUrl: string;
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
  imageUrl: "",
};

const emptyCard: CardDraft = {
  title: "",
  description: "",
  effectType: "MOVE_FORWARD",
  effectValue: 1,
};

const tileTypeIcons = { START: Flag, QUIZ: BookOpen, BONUS: Gift, EVENT: Zap, REST: Coffee } as const;
const editableTileTypeOptions = ["QUIZ", "BONUS", "EVENT", "REST"].map((type) => ({ value: type, label: tileTypeLabels[type as TileType] }));

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
    imageUrl: question.imageUrl ?? "",
  };
}

function cardDraft(card: GameCard): CardDraft {
  return { title: card.title, description: card.description, effectType: card.effectType, effectValue: card.effectValue || 1 };
}

// 폼 전용 하위 컴포넌트 — key가 바뀌면(칸/유형 변경) 초기값으로 새로 마운트된다.
function ContentForm({
  gameId,
  item,
  isCards,
  inTileMode,
  tileIndex,
  busy,
  onSave,
  onDelete,
  onError,
}: {
  gameId: string;
  item: GameQuestion | GameCard | null;
  isCards: boolean;
  inTileMode: boolean;
  tileIndex: number;
  busy: boolean;
  onSave: (body: Record<string, unknown>) => Promise<GameQuestion | GameCard>;
  onDelete: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [question, setQuestion] = useState<QuestionDraft>(() => item && !isCards ? questionDraft(item as GameQuestion) : { ...emptyQuestion, options: [...emptyQuestion.options] });
  const [card, setCard] = useState<CardDraft>(() => item && isCards ? cardDraft(item as GameCard) : { ...emptyCard });
  const [correctOptionIndex, setCorrectOptionIndex] = useState(() => item && !isCards ? Math.max(0, (item as GameQuestion).options.indexOf((item as GameQuestion).correctAnswer)) : 0);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const setQuestionValue = (field: keyof QuestionDraft, value: string | number | string[]) => {
    setQuestion((current) => ({ ...current, [field]: value } as QuestionDraft));
  };

  async function handleImageFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || uploading) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch(`/api/v1/games/${gameId}/media`, { method: "POST", body: form });
      const payload = await response.json() as { url?: string; error?: { message?: string } };
      if (!response.ok || !payload.url) throw new Error(payload.error?.message ?? "이미지를 업로드하지 못했습니다.");
      setQuestionValue("imageUrl", payload.url);
    } catch (error) {
      onError(error instanceof Error ? error.message : "이미지를 업로드하지 못했습니다.");
    } finally {
      setUploading(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    try {
      const saved = isCards
        ? await onSave({ ...card })
        : await onSave({
          ...question,
          correctAnswer: question.type === "MULTIPLE_CHOICE" ? question.options[correctOptionIndex] : question.correctAnswer,
        });
      if (isCards) setCard(cardDraft(saved as GameCard));
      else {
        setQuestion(questionDraft(saved as GameQuestion));
        setCorrectOptionIndex(Math.max(0, (saved as GameQuestion).options.indexOf((saved as GameQuestion).correctAnswer)));
      }
    } catch {
      // 오류 메시지는 상위에서 전달된다.
    }
  }

  async function remove() {
    if (busy) return;
    await onDelete();
    setCard({ ...emptyCard });
    setQuestion({ ...emptyQuestion, options: [...emptyQuestion.options] });
    setCorrectOptionIndex(0);
  }

  return (
    <form className="question-form" onSubmit={submit}>
      {isCards ? (
        <>
          <div className="form-row form-row--split">
            <label><span>카드 이름</span><input value={card.title} onChange={(event) => setCard((current) => ({ ...current, title: event.target.value }))} placeholder="예: 집중력 보너스" required /></label>
            <div className="form-field"><span>효과</span><SelectMenu label="효과" icon={Sparkles} value={card.effectType} options={Object.entries(cardEffectLabels).map(([value, label]) => ({ value, label }))} onChange={(value) => setCard((current) => ({ ...current, effectType: value as CardEffectType }))} /></div>
          </div>
          {(card.effectType === "MOVE_FORWARD" || card.effectType === "MOVE_BACK" || card.effectType === "SCORE_BONUS") && (
            <label><span>{card.effectType === "SCORE_BONUS" ? "추가 점수" : "이동 칸 수"}</span><input type="number" min="1" max={card.effectType === "SCORE_BONUS" ? 100 : 12} value={card.effectValue} onChange={(event) => setCard((current) => ({ ...current, effectValue: Number(event.target.value) }))} /></label>
          )}
          <label><span>안내</span><textarea value={card.description} onChange={(event) => setCard((current) => ({ ...current, description: event.target.value }))} placeholder="뽑았을 때 보여줄 문구" /></label>
          <div className="answer-preview answer-preview--card"><Sparkles aria-hidden="true" /><span><strong>{card.title || "카드 미리보기"}</strong><small>{card.description || `${cardEffectLabels[card.effectType]} 효과`}</small></span></div>
        </>
      ) : (
        <>
          <div className="form-row form-row--split">
            <div className="form-field"><span>문제 유형</span><SelectMenu label="문제 유형" icon={CircleHelp} value={question.type} options={Object.entries(questionTypeLabels).map(([value, label]) => ({ value, label }))} onChange={(value) => setQuestion((current) => ({ ...current, type: value as QuestionType, correctAnswer: "" }))} /></div>
            <div className="form-field"><span>풀이 방식</span><SelectMenu label="풀이 방식" icon={Users} value={question.answerMode} options={[{ value: "TURN", label: "현재 차례만" }, { value: "ALL", label: "전원 동시" }]} onChange={(value) => setQuestion((current) => ({ ...current, answerMode: value as AnswerMode }))} /></div>
          </div>
          <label><span>질문</span><textarea value={question.prompt} onChange={(event) => setQuestionValue("prompt", event.target.value)} placeholder="질문 입력" required /></label>
          <div className="form-field"><span>이미지 (선택)</span>
            <span className="question-image">
              {question.imageUrl ? (
                <span className="question-image__preview">
                  {/* eslint-disable-next-line @next/next/no-img-element -- R2 제공 이미지 */}
                  <img src={question.imageUrl} alt="문제 이미지 미리보기" />
                  <span className="question-image__actions"><strong>첨부됨</strong><button type="button" className="text-button" onClick={() => setQuestionValue("imageUrl", "")}>제거</button></span>
                </span>
              ) : (
                <button type="button" className="question-image__pick" onClick={() => fileRef.current?.click()} disabled={uploading}><ImagePlus aria-hidden="true" />{uploading ? "업로드 중…" : "이미지 첨부"}</button>
              )}
              <input hidden ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => void handleImageFile(event)} />
            </span>
          </div>
          {question.type === "MULTIPLE_CHOICE" && (
            <fieldset className="choice-editor"><legend>보기와 정답</legend>{question.options.map((option, index) => <label key={index}><input type="radio" name="correct-option" checked={correctOptionIndex === index} onChange={() => setCorrectOptionIndex(index)} aria-label={`${index + 1}번 보기를 정답으로 선택`} /><span>{index + 1}</span><input value={option} onChange={(event) => setQuestion((current) => ({ ...current, options: current.options.map((item, itemIndex) => itemIndex === index ? event.target.value : item) }))} placeholder={`${index + 1}번 보기`} required={index < 2} /></label>)}</fieldset>
          )}
          {question.type === "SHORT_ANSWER" && <label><span>정답</span><input value={question.correctAnswer} onChange={(event) => setQuestionValue("correctAnswer", event.target.value)} placeholder="예: 규장각 (쉼표 구분)" required /></label>}
          {question.type === "OX" && <fieldset className="ox-editor"><legend>정답</legend>{["O", "X"].map((value) => <label key={value}><input type="radio" name="ox-answer" value={value} checked={question.correctAnswer === value} onChange={() => setQuestionValue("correctAnswer", value)} /><span>{value}</span></label>)}</fieldset>}
          <div className="form-row form-row--split">
            <label><span>배점</span><input type="number" min="1" max="100" value={question.points} onChange={(event) => setQuestionValue("points", Number(event.target.value))} /></label>
            <div className="form-field"><span>제한 시간</span><SelectMenu label="제한 시간" icon={Clock3} value={String(question.timeLimitSeconds)} options={[10, 20, 30, 45, 60, 90, 120].map((seconds) => ({ value: String(seconds), label: `${seconds}초` }))} onChange={(value) => setQuestionValue("timeLimitSeconds", Number(value))} /></div>
          </div>
          <label><span>해설 (선택)</span><input value={question.explanation} onChange={(event) => setQuestionValue("explanation", event.target.value)} placeholder="정답 공개 시 표시" /></label>
          <div className="answer-preview"><CircleHelp aria-hidden="true" /><span><strong>정답 비공개</strong><small>{inTileMode ? `${tileIndex + 1}번 도착 시 출제` : "순환 출제"}</small></span></div>
        </>
      )}
      <div className="question-form__actions">
        {item && <button className="button button--danger" type="button" onClick={() => void remove()} disabled={busy}><Trash2 /> 삭제</button>}
        <button className="button button--ink" type="submit" disabled={busy}>{busy ? "저장 중" : item ? "변경 저장" : "저장"}</button>
      </div>
    </form>
  );
}

// 문제·카드 섹션 — 맵에서 칸을 고르면 그 칸의 유형 선택 + 콘텐츠 편집이 한 곳에서 이뤄진다.
// 유형 변경은 상위(스튜디오)가 즉시 저장하고, 폼은 칸 유형에 맞춰 문제/카드로 전환된다.
export function ContentEditor({
  gameId,
  enabled,
  tileTypes,
  selectedTileIndex,
  onSelectTile,
  onTileTypeChange,
  onMessage,
  onCountsChange,
  onMarksChange,
}: {
  gameId: string;
  enabled: boolean;
  tileTypes: TileType[];
  selectedTileIndex: number;
  onSelectTile: (index: number) => void;
  onTileTypeChange: (index: number, type: TileType) => void;
  onMessage: (message: string) => void;
  onCountsChange: (questions: number, cards: number) => void;
  onMarksChange: (marks: BoardTileMark[]) => void;
}) {
  const [questions, setQuestions] = useState<GameQuestion[]>([]);
  const [cards, setCards] = useState<GameCard[]>([]);
  const [busy, setBusy] = useState(false);

  const effectiveTileTypes = tileTypes.length === 24 ? tileTypes : null;
  const selectedTileType = effectiveTileTypes?.[selectedTileIndex] ?? "QUIZ";
  // 칸 유형이 곧 편집 대상 — 퀴즈면 문제, 이벤트·보너스면 카드, 그 외엔 폼 없음.
  const tileKind: ContentKind | null = selectedTileType === "QUIZ" ? "questions" : selectedTileType === "EVENT" || selectedTileType === "BONUS" ? "cards" : null;
  const isCards = tileKind === "cards";
  const currentQuestion = questions.find((item) => item.tileIndex === selectedTileIndex) ?? null;
  const currentCard = cards.find((item) => item.tileIndex === selectedTileIndex) ?? null;
  const editingItem = isCards ? currentCard : currentQuestion;
  const formKey = `tile-${selectedTileIndex}-${tileKind ?? "none"}`;

  function pushMarks(nextQuestions: GameQuestion[], nextCards: GameCard[]) {
    onMarksChange([
      ...nextQuestions.filter((item) => item.tileIndex != null).map((item) => ({ index: item.tileIndex as number, kind: "question" as const })),
      ...nextCards.filter((item) => item.tileIndex != null).map((item) => ({ index: item.tileIndex as number, kind: "card" as const })),
    ]);
  }

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void (async () => {
      try {
        const [questionPayload, cardPayload] = await Promise.all([
          fetch(`/api/v1/games/${gameId}/questions`).then((response) => responsePayload<{ questions: GameQuestion[] }>(response)),
          fetch(`/api/v1/games/${gameId}/cards`).then((response) => responsePayload<{ cards: GameCard[] }>(response)),
        ]);
        if (cancelled) return;
        setQuestions(questionPayload.questions);
        setCards(cardPayload.cards);
        onCountsChange(questionPayload.questions.length, cardPayload.cards.length);
        pushMarks(questionPayload.questions, cardPayload.cards);
        // 기본 선택: 콘텐츠를 넣을 수 있는 첫 칸
        const contentCapable = ["QUIZ", "EVENT", "BONUS"];
        const currentType = effectiveTileTypes?.[selectedTileIndex];
        if (!contentCapable.includes(String(currentType))) {
          const firstEligible = effectiveTileTypes?.findIndex((type) => contentCapable.includes(type)) ?? -1;
          if (firstEligible >= 0) onSelectTile(firstEligible);
        }
      } catch (error) {
        if (!cancelled) onMessage(error instanceof Error ? error.message : "콘텐츠를 불러오지 못했습니다.");
      }
    })();
    return () => { cancelled = true; };
    // Callback props intentionally do not trigger content reloads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, gameId]);

  async function save(body: Record<string, unknown>) {
    if (busy || !tileKind) return null as never;
    setBusy(true);
    try {
      const kind = tileKind;
      const isUpdate = Boolean(editingItem);
      const payload = { ...body, tileIndex: selectedTileIndex };
      const path = kind === "cards"
        ? isUpdate ? `/api/v1/games/${gameId}/cards/${editingItem!.id}` : `/api/v1/games/${gameId}/cards`
        : isUpdate ? `/api/v1/games/${gameId}/questions/${editingItem!.id}` : `/api/v1/games/${gameId}/questions`;
      const response = await fetch(path, { method: isUpdate ? "PUT" : "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const saved = kind === "cards"
        ? (await responsePayload<{ card: GameCard }>(response)).card
        : (await responsePayload<{ question: GameQuestion }>(response)).question;
      if (kind === "cards") {
        const nextCards = isUpdate ? cards.map((item) => item.id === saved.id ? saved as GameCard : item) : [...cards, saved as GameCard];
        setCards(nextCards);
        onCountsChange(questions.length, nextCards.length);
        pushMarks(questions, nextCards);
      } else {
        const nextQuestions = isUpdate ? questions.map((item) => item.id === saved.id ? saved as GameQuestion : item) : [...questions, saved as GameQuestion];
        setQuestions(nextQuestions);
        onCountsChange(nextQuestions.length, cards.length);
        pushMarks(nextQuestions, cards);
      }
      onMessage(`${kind === "cards" ? "카드" : "문제"}를 ${isUpdate ? "수정" : "저장"}했습니다.`);
      return saved;
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "저장하지 못했습니다.");
      throw error;
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!editingItem || busy || !tileKind) return;
    setBusy(true);
    try {
      const id = editingItem.id;
      const kind = tileKind;
      const path = kind === "cards" ? `/api/v1/games/${gameId}/cards/${id}` : `/api/v1/games/${gameId}/questions/${id}`;
      const response = await fetch(path, { method: "DELETE" });
      await responsePayload<Record<string, never>>(response);
      if (kind === "cards") {
        const remaining = cards.filter((item) => item.id !== id);
        setCards(remaining);
        onCountsChange(questions.length, remaining.length);
        pushMarks(questions, remaining);
      } else {
        const remaining = questions.filter((item) => item.id !== id);
        setQuestions(remaining);
        onCountsChange(remaining.length, cards.length);
        pushMarks(remaining, cards);
      }
      onMessage(`${kind === "cards" ? "카드" : "문제"}를 삭제했습니다.`);
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "삭제하지 못했습니다.");
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

  const TileIcon = tileTypeIcons[selectedTileType];
  const tileStatus = selectedTileType === "QUIZ"
    ? currentQuestion ? "저장된 문제 수정" : "새 문제 입력"
    : selectedTileType === "EVENT" || selectedTileType === "BONUS"
      ? currentCard ? "저장된 카드 수정" : "새 카드 입력"
      : selectedTileType === "REST" ? "효과 없음" : "입력 없음";

  return (
    <section className="question-editor content-tile-editor" aria-labelledby="content-editor-heading">
      <div className="question-editor__head">
        <div>
          <h2 id="content-editor-heading">문제·카드</h2>
          <p>칸을 눌러 편집</p>
        </div>
        <span className="content-tile-editor__coverage">문제 {questions.length} · 카드 {cards.length}</span>
      </div>

      <div className="content-tile-editor__tile">
        <span className={`tile-inspector__mark tile-inspector__mark--${selectedTileType.toLowerCase()}`} aria-hidden="true"><TileIcon /></span>
        <span className="tile-inspector__copy">
          <strong>{Math.max(0, selectedTileIndex) + 1}번 · {tileTypeLabels[selectedTileType]}</strong>
          <small>{tileStatus}</small>
        </span>
        <span className="content-tile-editor__type">
          <small>칸 유형</small>
          {selectedTileType === "START"
            ? <span className="content-tile-editor__type-fixed">시작</span>
            : <SelectMenu label="칸 유형" icon={Grid2X2} value={selectedTileType} options={editableTileTypeOptions} onChange={(value) => onTileTypeChange(selectedTileIndex, value as TileType)} />}
        </span>
      </div>

      {tileKind === null && (
        <div className="tile-inspector__lock" role="note">
          <BookOpen aria-hidden="true" />
          <span>{selectedTileType === "REST" ? "휴식 칸은 건너뜁니다" : "시작 칸은 비워 둡니다"}</span>
        </div>
      )}

      {tileKind !== null && (
        <ContentForm
          key={formKey}
          gameId={gameId}
          item={editingItem}
          isCards={isCards}
          inTileMode
          tileIndex={selectedTileIndex}
          busy={busy}
          onSave={save}
          onDelete={remove}
          onError={onMessage}
        />
      )}
    </section>
  );
}