export type QuestionType = "MULTIPLE_CHOICE" | "SHORT_ANSWER" | "OX";
export type AnswerMode = "TURN" | "ALL";
export type CardEffectType = "MOVE_FORWARD" | "MOVE_BACK" | "SCORE_BONUS" | "EXTRA_TURN" | "SKIP_TURN";

export type GameQuestion = {
  id: string;
  gameId: string;
  tileIndex: number | null;
  type: QuestionType;
  prompt: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
  points: number;
  timeLimitSeconds: number;
  answerMode: AnswerMode;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
};

export type GameCard = {
  id: string;
  gameId: string;
  tileIndex: number | null;
  title: string;
  description: string;
  effectType: CardEffectType;
  effectValue: number;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
};

export type QuestionInput = Pick<GameQuestion, "type" | "prompt" | "options" | "correctAnswer" | "explanation" | "points" | "timeLimitSeconds" | "answerMode">;
export type CardInput = Pick<GameCard, "title" | "description" | "effectType" | "effectValue">;

const questionTypes: QuestionType[] = ["MULTIPLE_CHOICE", "SHORT_ANSWER", "OX"];
const cardEffectTypes: CardEffectType[] = ["MOVE_FORWARD", "MOVE_BACK", "SCORE_BONUS", "EXTRA_TURN", "SKIP_TURN"];

export const questionTypeLabels: Record<QuestionType, string> = {
  MULTIPLE_CHOICE: "객관식",
  SHORT_ANSWER: "주관식",
  OX: "O/X",
};

export const cardEffectLabels: Record<CardEffectType, string> = {
  MOVE_FORWARD: "앞으로 이동",
  MOVE_BACK: "뒤로 이동",
  SCORE_BONUS: "점수 보너스",
  EXTRA_TURN: "한 번 더",
  SKIP_TURN: "한 번 쉬기",
};

function boundedInteger(value: unknown, fallback: number, minimum: number, maximum: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

export function parseQuestionInput(value: unknown): QuestionInput {
  const payload = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const type = questionTypes.includes(payload.type as QuestionType) ? payload.type as QuestionType : "SHORT_ANSWER";
  const prompt = typeof payload.prompt === "string" ? payload.prompt.trim() : "";
  if (!prompt) throw new Error("질문을 입력하세요.");

  let options = Array.isArray(payload.options)
    ? payload.options.map((option) => String(option).trim()).filter(Boolean)
    : [];
  let correctAnswer = typeof payload.correctAnswer === "string" ? payload.correctAnswer.trim() : "";

  if (type === "MULTIPLE_CHOICE") {
    if (options.length < 2 || options.length > 6) throw new Error("객관식 보기는 2개 이상 6개 이하로 입력하세요.");
    if (!options.includes(correctAnswer)) throw new Error("보기 중 하나를 정답으로 선택하세요.");
  } else if (type === "OX") {
    options = ["O", "X"];
    correctAnswer = correctAnswer.toUpperCase();
    if (correctAnswer !== "O" && correctAnswer !== "X") throw new Error("O 또는 X를 정답으로 선택하세요.");
  } else {
    options = [];
    if (!correctAnswer) throw new Error("주관식 정답을 입력하세요.");
  }

  return {
    type,
    prompt,
    options,
    correctAnswer,
    explanation: typeof payload.explanation === "string" ? payload.explanation.trim() : "",
    points: boundedInteger(payload.points, 10, 1, 100),
    timeLimitSeconds: boundedInteger(payload.timeLimitSeconds, 30, 5, 300),
    answerMode: payload.answerMode === "ALL" ? "ALL" : "TURN",
  };
}

export function parseCardInput(value: unknown): CardInput {
  const payload = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const title = typeof payload.title === "string" ? payload.title.trim() : "";
  if (!title) throw new Error("카드 이름을 입력하세요.");
  const effectType = cardEffectTypes.includes(payload.effectType as CardEffectType)
    ? payload.effectType as CardEffectType
    : "MOVE_FORWARD";
  const requiresValue = effectType === "MOVE_FORWARD" || effectType === "MOVE_BACK" || effectType === "SCORE_BONUS";
  return {
    title,
    description: typeof payload.description === "string" ? payload.description.trim() : "",
    effectType,
    effectValue: requiresValue ? boundedInteger(payload.effectValue, 1, 1, effectType === "SCORE_BONUS" ? 100 : 12) : 0,
  };
}

export function parseOptions(optionsJson: string) {
  try {
    const parsed = JSON.parse(optionsJson) as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

// 칸 고정 연결(tileIndex)은 칸·콘텐츠 모델에서만 쓰이는 값이라 파서와 분리해 다룬다.
// 0–23 정수면 해당 값, 아니면(미지정·오류) null로 정규화한다.
export function normalizeOptionalTileIndex(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed)) return null;
  return Math.min(23, Math.max(0, parsed));
}
