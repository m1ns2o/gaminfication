"use client";
import "../studio.css";

import { BookOpen, CircleHelp, Clock3, Grid2X2, Plus, Sparkles, Trash2, Users, Zap } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
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

type EditorSection = "questions" | "cards";
type ContentMode = "tile" | "pool";

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
  };
}

function cardDraft(card: GameCard): CardDraft {
  return { title: card.title, description: card.description, effectType: card.effectType, effectValue: card.effectValue || 1 };
}

// 폼 전용 하위 컴포넌트 — key가 바뀌면(칸/아이템 변경) 초기값으로 새로 마운트된다.
// 상위(ContentEditor)가 API 호출·목록 상태를 담당하고, 이 컴포넌트는 입력값만 관리한다.
function ContentForm({
  item,
  isCards,
  inTileMode,
  tileIndex,
  busy,
  onSave,
  onDelete,
}: {
  item: GameQuestion | GameCard | null;
  isCards: boolean;
  inTileMode: boolean;
  tileIndex: number;
  busy: boolean;
  onSave: (body: Record<string, unknown>) => Promise<GameQuestion | GameCard>;
  onDelete: () => Promise<void>;
}) {
  const [question, setQuestion] = useState<QuestionDraft>(() => item && !isCards ? questionDraft(item as GameQuestion) : { ...emptyQuestion, options: [...emptyQuestion.options] });
  const [card, setCard] = useState<CardDraft>(() => item && isCards ? cardDraft(item as GameCard) : { ...emptyCard });
  const [correctOptionIndex, setCorrectOptionIndex] = useState(() => item && !isCards ? Math.max(0, (item as GameQuestion).options.indexOf((item as GameQuestion).correctAnswer)) : 0);

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

  const setQuestionValue = (field: keyof QuestionDraft, value: string | number | string[]) => {
    setQuestion((current) => ({ ...current, [field]: value } as QuestionDraft));
  };

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
          <label><span>참가자 안내</span><textarea value={card.description} onChange={(event) => setCard((current) => ({ ...current, description: event.target.value }))} placeholder="카드를 뽑았을 때 보여 줄 짧은 안내를 적어 주세요." /></label>
          <div className="answer-preview answer-preview--card"><Sparkles aria-hidden="true" /><span><strong>{card.title || "카드 미리보기"}</strong><small>{card.description || `${cardEffectLabels[card.effectType]} 효과가 적용됩니다.`}</small></span></div>
        </>
      ) : (
        <>
          <div className="form-row form-row--split">
            <div className="form-field"><span>문제 유형</span><SelectMenu label="문제 유형" icon={CircleHelp} value={question.type} options={Object.entries(questionTypeLabels).map(([value, label]) => ({ value, label }))} onChange={(value) => setQuestion((current) => ({ ...current, type: value as QuestionType, correctAnswer: "" }))} /></div>
            <div className="form-field"><span>풀이 방식</span><SelectMenu label="풀이 방식" icon={Users} value={question.answerMode} options={[{ value: "TURN", label: "현재 차례만" }, { value: "ALL", label: "전원 동시" }]} onChange={(value) => setQuestion((current) => ({ ...current, answerMode: value as AnswerMode }))} /></div>
          </div>
          <label><span>질문</span><textarea value={question.prompt} onChange={(event) => setQuestionValue("prompt", event.target.value)} placeholder="이 칸에서 학습 내용을 확인할 질문을 입력하세요." required /></label>
          {question.type === "MULTIPLE_CHOICE" && (
            <fieldset className="choice-editor"><legend>보기와 정답</legend>{question.options.map((option, index) => <label key={index}><input type="radio" name="correct-option" checked={correctOptionIndex === index} onChange={() => setCorrectOptionIndex(index)} aria-label={`${index + 1}번 보기를 정답으로 선택`} /><span>{index + 1}</span><input value={option} onChange={(event) => setQuestion((current) => ({ ...current, options: current.options.map((item, itemIndex) => itemIndex === index ? event.target.value : item) }))} placeholder={`${index + 1}번 보기`} required={index < 2} /></label>)}</fieldset>
          )}
          {question.type === "SHORT_ANSWER" && <label><span>허용 정답</span><input value={question.correctAnswer} onChange={(event) => setQuestionValue("correctAnswer", event.target.value)} placeholder="예: 규장각 (복수 정답은 쉼표로 구분)" required /></label>}
          {question.type === "OX" && <fieldset className="ox-editor"><legend>정답</legend>{["O", "X"].map((value) => <label key={value}><input type="radio" name="ox-answer" value={value} checked={question.correctAnswer === value} onChange={() => setQuestionValue("correctAnswer", value)} /><span>{value}</span></label>)}</fieldset>}
          <div className="form-row form-row--split">
            <label><span>배점</span><input type="number" min="1" max="100" value={question.points} onChange={(event) => setQuestionValue("points", Number(event.target.value))} /></label>
            <div className="form-field"><span>제한 시간</span><SelectMenu label="제한 시간" icon={Clock3} value={String(question.timeLimitSeconds)} options={[10, 20, 30, 45, 60, 90, 120].map((seconds) => ({ value: String(seconds), label: `${seconds}초` }))} onChange={(value) => setQuestionValue("timeLimitSeconds", Number(value))} /></div>
          </div>
          <label><span>정답 해설 (선택)</span><input value={question.explanation} onChange={(event) => setQuestionValue("explanation", event.target.value)} placeholder="정답 공개 때 보여 줄 설명" /></label>
          <div className="answer-preview"><CircleHelp aria-hidden="true" /><span><strong>정답은 출제자와 서버만 확인합니다.</strong><small>게임 중 참가자에게는 {inTileMode ? `${tileIndex + 1}번 칸에 도착했을 때` : "공용 풀에서"} 문제와 응답 양식만 표시됩니다.</small></span></div>
        </>
      )}
      <div className="question-form__actions">
        {item && <button className="button button--danger" type="button" onClick={() => void remove()} disabled={busy}><Trash2 /> 삭제</button>}
        <button className="button button--ink" type="submit" disabled={busy}>{busy ? "저장 중" : item ? "변경 저장" : inTileMode ? "칸에 저장" : "공용 풀에 저장"}</button>
      </div>
    </form>
  );
}

// 문제/카드 섹션은 "맵에서 칸을 고르고 그 칸에 콘텐츠를 직접 입력"하는 흐름이다.
// 공용 풀(칸 미지정)은 기존 게임 데이터와 추가 콘텐츠를 위한 보조 영역으로 남겨 둔다.
export function ContentEditor({
  gameId,
  enabled,
  section,
  tileTypes,
  selectedTileIndex,
  contentMode,
  onSelectTile,
  onContentModeChange,
  onTileTypeChange,
  onMessage,
  onCountsChange,
  onMarksChange,
}: {
  gameId: string;
  enabled: boolean;
  section: EditorSection;
  tileTypes: TileType[];
  selectedTileIndex: number;
  contentMode: ContentMode;
  onSelectTile: (index: number) => void;
  onContentModeChange: (mode: ContentMode) => void;
  onTileTypeChange: (index: number, type: TileType) => void;
  onMessage: (message: string) => void;
  onCountsChange: (questions: number, cards: number) => void;
  onMarksChange: (marks: BoardTileMark[]) => void;
}) {
  const isCards = section === "cards";
  const [questions, setQuestions] = useState<GameQuestion[]>([]);
  const [cards, setCards] = useState<GameCard[]>([]);
  const [poolSelectedId, setPoolSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const effectiveTileTypes = tileTypes.length === 24 ? tileTypes : null;

  const items: (GameQuestion | GameCard)[] = isCards ? cards : questions;
  const boundItems = useMemo(() => items.filter((item) => item.tileIndex != null), [items]);
  const poolItems = useMemo(() => items.filter((item) => item.tileIndex == null), [items]);
  const currentTileItem = boundItems.find((item) => item.tileIndex === selectedTileIndex) ?? null;
  const inTileMode = contentMode === "tile";
  const editingItem = inTileMode ? currentTileItem : poolItems.find((item) => item.id === poolSelectedId) ?? null;
  // 칸이 바뀌면 폼이 새로 마운트되어 해당 칸의 콘텐츠를 불러온다.
  const formKey = inTileMode ? `tile-${selectedTileIndex}` : `pool-${poolSelectedId ?? "new"}`;

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
        // 기본 선택: 이 섹션에서 편집 가능한 첫 칸
        const allowed = isCards ? ["EVENT", "BONUS"] : ["QUIZ"];
        const currentType = effectiveTileTypes?.[selectedTileIndex];
        if (!allowed.includes(String(currentType))) {
          const firstEligible = effectiveTileTypes?.findIndex((type) => allowed.includes(type)) ?? -1;
          if (firstEligible >= 0) onSelectTile(firstEligible);
        }      } catch (error) {
        if (!cancelled) onMessage(error instanceof Error ? error.message : "콘텐츠를 불러오지 못했습니다.");
      }
    })();
    return () => { cancelled = true; };
    // Callback props intentionally do not trigger content reloads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, gameId, isCards]);

  async function save(body: Record<string, unknown>) {
    if (busy) return null as never;
    setBusy(true);
    try {
      const bound = inTileMode && selectedTileIndex >= 0 ? selectedTileIndex : null;
      const payload = { ...body, tileIndex: bound };
      const isUpdate = Boolean(editingItem);
      const path = isCards
        ? isUpdate ? `/api/v1/games/${gameId}/cards/${editingItem!.id}` : `/api/v1/games/${gameId}/cards`
        : isUpdate ? `/api/v1/games/${gameId}/questions/${editingItem!.id}` : `/api/v1/games/${gameId}/questions`;
      const method = isUpdate ? "PUT" : "POST";
      const response = await fetch(path, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const saved = isCards
        ? (await responsePayload<{ card: GameCard }>(response)).card
        : (await responsePayload<{ question: GameQuestion }>(response)).question;
      if (isCards) {
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
      onMessage(`${isCards ? "카드" : "문제"} ${isUpdate ? "변경 내용을" : "하나를"} 저장했습니다.`);
      return saved;
    } catch (error) {
      onMessage(error instanceof Error ? error.message : `${isCards ? "카드" : "문제"}를 저장하지 못했습니다.`);
      throw error;
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!editingItem || busy) return;
    setBusy(true);
    try {
      const id = editingItem.id;
      const path = isCards ? `/api/v1/games/${gameId}/cards/${id}` : `/api/v1/games/${gameId}/questions/${id}`;
      const response = await fetch(path, { method: "DELETE" });
      await responsePayload<Record<string, never>>(response);
      if (isCards) {
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
      setPoolSelectedId(null);
      onContentModeChange("tile");
      onMessage(`${isCards ? "카드" : "문제"}를 삭제했습니다.`);
    } catch (error) {
      onMessage(error instanceof Error ? error.message : "삭제하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  function openPoolItem(item: GameQuestion | GameCard) {
    setPoolSelectedId(item.id);
    onContentModeChange("pool");
  }

  function openNewPool() {
    setPoolSelectedId(null);
    onContentModeChange("pool");
  }

  if (!enabled) {
    return (
      <section className="question-editor content-empty" aria-labelledby="content-editor-heading">
        <h2 id="content-editor-heading">콘텐츠 편집 준비 중</h2>
        <p>게임 초안이 저장되면 문제와 카드를 만들 수 있습니다.</p>
      </section>
    );
  }

  return (
    <section className="question-editor content-tile-editor" aria-labelledby="content-editor-heading">
      <div className="question-editor__head">
        <div>
          <h2 id="content-editor-heading">{isCards ? "카드 칸" : "문제 칸"}</h2>
          <p>
            {isCards
              ? "오른쪽 맵에서 칸을 눌러 그 칸에 적용할 카드를 입력하세요. 왼쪽의 칸 유형 드롭다운으로 어떤 칸이든 이벤트·보너스 칸으로 바꿀 수 있어요."
              : "오른쪽 맵에서 칸을 눌러 그 칸에 낼 문제와 정답을 입력하세요. 왼쪽의 칸 유형 드롭다운으로 어떤 칸이든 퀴즈 칸으로 바꿀 수 있어요."}
          </p>
        </div>
        <span className="content-tile-editor__coverage">
          {isCards ? `카드 ${cards.length}개` : `문제 ${questions.length}개`}
        </span>
      </div>

      {(() => {
        const selectedTileType = effectiveTileTypes?.[selectedTileIndex] ?? "QUIZ";
        const tileTone = selectedTileType.toLowerCase();
        const TileIcon = selectedTileType === "EVENT" ? Zap : selectedTileType === "BONUS" ? Sparkles : selectedTileType === "REST" ? BookOpen : selectedTileType === "START" ? BookOpen : BookOpen;
        const typeMatches = isCards ? selectedTileType === "EVENT" || selectedTileType === "BONUS" : selectedTileType === "QUIZ";
        return (
          <>
            {/* 선택 칸(또는 공용 풀) 컨텍스트 */}
            <div className="content-tile-editor__tile">
              <span className="tile-inspector__number">{String(Math.max(0, selectedTileIndex) + 1).padStart(2, "0")}</span>
              <span className={`tile-inspector__mark tile-inspector__mark--${tileTone}`} aria-hidden="true"><TileIcon /></span>
              <span className="tile-inspector__copy">
                <span className="mono-label">TILE {String(Math.max(0, selectedTileIndex) + 1).padStart(2, "0")}</span>
                <strong>{inTileMode ? `${Math.max(0, selectedTileIndex) + 1}번 칸 · ${tileTypeLabels[selectedTileType]}` : "공용 풀"}</strong>
                <small>
                  {inTileMode
                    ? currentTileItem
                      ? isCards ? "이 칸에 적용할 카드가 저장되어 있습니다. 수정하거나 삭제할 수 있어요." : "이 칸에서 출제할 문제가 저장되어 있습니다. 수정하거나 삭제할 수 있어요."
                      : isCards ? "아직 카드가 없습니다. 효과를 정하고 저장하면 이 칸에서 나옵니다." : "아직 문제가 없습니다. 문제와 정답을 입력하고 저장하세요."
                    : "칸과 무관하게 특정 순환 순서로 배치되는 공용 콘텐츠입니다."}
                </small>
              </span>
              <span className="content-tile-editor__type">
                <small>칸 유형</small>
                {selectedTileType === "START"
                  ? <span className="content-tile-editor__type-fixed">시작</span>
                  : <SelectMenu label="칸 유형" icon={Grid2X2} value={selectedTileType} options={editableTileTypeOptions} onChange={(value) => onTileTypeChange(selectedTileIndex, value as TileType)} />}
              </span>
            </div>

            {!typeMatches && inTileMode && (
              <div className="tile-inspector__lock" role="note">
                <BookOpen aria-hidden="true" />
                <span>{isCards ? `이 칸은 지금 ${tileTypeLabels[selectedTileType]} 칸이라 카드가 발동하지 않아요. 위 칸 유형 드롭다운에서 이벤트·보너스 칸으로 바꿔 주세요.` : `이 칸은 지금 ${tileTypeLabels[selectedTileType]} 칸이라 문제가 출제되지 않아요. 위 칸 유형 드롭다운에서 퀴즈 칸으로 바꿔 주세요.`}</span>
              </div>
            )}

            <ContentForm
              key={formKey}
              item={editingItem}
              isCards={isCards}
              inTileMode={inTileMode}
              tileIndex={selectedTileIndex}
              busy={busy}
              onSave={save}
              onDelete={remove}
            />
          </>
        );
      })()}

      {/* 공용 풀 — 기존 게임 데이터와 추가 콘텐츠 */}
      <div className="pool-bank" aria-labelledby="pool-bank-heading">
        <div className="pool-bank__head">
          <div>
            <h3 id="pool-bank-heading">공용 {isCards ? "카드" : "문제"} 풀</h3>
            <p>칸과 무관하게 순환 배치됩니다{inTileMode && !currentTileItem ? ` — 현재 ${selectedTileIndex + 1}번 칸도 이 풀을 사용합니다.` : ""}</p>
          </div>
          <button className="button button--outline" type="button" onClick={openNewPool}><Plus aria-hidden="true" /> {isCards ? "카드" : "문제"} 추가</button>
        </div>
        {poolItems.length === 0 ? (
          <p className="content-empty__hint">아직 공용 {isCards ? "카드" : "문제"}가 없습니다. 모든 칸을 채우지 않아도, 지정한 칸부터 바로 게임할 수 있어요.</p>
        ) : (
          <ul className="pool-bank__list">
            {poolItems.map((item) => (
              <li key={item.id}>
                <button type="button" className={item.id === poolSelectedId && !inTileMode ? "is-selected" : ""} onClick={() => openPoolItem(item)}>
                  <span className="pool-bank__index">{String(poolItems.indexOf(item) + 1).padStart(2, "0")}</span>
                  <span className="pool-bank__copy"><strong>{isCards ? (item as GameCard).title : (item as GameQuestion).prompt}</strong><small>{isCards ? cardEffectLabels[(item as GameCard).effectType] : `${questionTypeLabels[(item as GameQuestion).type]} · ${(item as GameQuestion).points}점`}</small></span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}