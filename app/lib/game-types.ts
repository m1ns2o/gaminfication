import type { BoardGeometryId, SkinId, TileType } from "./board";
import type { EditableGameSettings } from "../components/game-settings-editor";

export type GameStatus = "DRAFT" | "PUBLISHED" | "PENDING_REVIEW";

export type Game = {
  id: string;
  title: string;
  description: string;
  subject: string;
  grade: string;
  template: BoardGeometryId;
  skin: SkinId;
  status: GameStatus;
  visibility: "PRIVATE" | "UNLISTED" | "PUBLIC";
  updated: string;
  questions: number;
  cards: number;
  victoryMode?: "AUTO" | "SCORE" | "ROUNDS" | "FINISH";
  targetScore?: number;
  maxRounds?: number;
  tileTypes?: TileType[];
  playMode?: "INDIVIDUAL" | "TEAM";
  teamCount?: number;
};

export type ApiGame = {
  id: string;
  title: string;
  description: string;
  subject: string;
  grade: string;
  template: BoardGeometryId;
  skin: SkinId;
  status: GameStatus;
  visibility: "PRIVATE" | "UNLISTED" | "PUBLIC";
  updatedAt: string;
  questionsCount: number;
  cardsCount: number;
  victoryMode: "AUTO" | "SCORE" | "ROUNDS" | "FINISH";
  targetScore: number;
  maxRounds: number;
  tileConfigJson: string;
  playMode: "INDIVIDUAL" | "TEAM";
  teamCount: number;
};

// /api/v1/library가 반환하는 공유마당 게임 (발행된 게임 중 일부 필드만)
export type LibraryGame = Pick<
  Game,
  "id" | "title" | "description" | "subject" | "grade" | "template" | "skin" | "updated" | "questions" | "cards"
>;

export type JoinRoomInfo = {
  gameTitle: string;
  playMode: "INDIVIDUAL" | "TEAM";
  teamCount: number;
};

export function fromApiGame(game: ApiGame): Game {
  let tileTypes: TileType[] = [];
  try {
    const parsed = JSON.parse(game.tileConfigJson) as TileType[];
    if (parsed.length === 24) tileTypes = parsed;
  } catch {
    // Older games use the default board layout.
  }
  return {
    id: game.id,
    title: game.title,
    description: game.description,
    subject: game.subject,
    grade: game.grade,
    template: game.template,
    skin: game.skin,
    status: game.status,
    visibility: game.visibility,
    updated: new Intl.DateTimeFormat("ko-KR", { month: "short", day: "numeric" }).format(new Date(game.updatedAt)),
    questions: game.questionsCount,
    cards: game.cardsCount,
    victoryMode: game.victoryMode,
    targetScore: game.targetScore,
    maxRounds: game.maxRounds,
    tileTypes,
    playMode: game.playMode,
    teamCount: game.teamCount,
  };
}

export function toEditableSettings(game: Game): EditableGameSettings {
  return {
    id: game.id,
    title: game.title,
    description: game.description,
    subject: game.subject,
    grade: game.grade,
    template: game.template,
    skin: game.skin,
    victoryMode: game.victoryMode ?? "AUTO",
    targetScore: game.targetScore ?? 100,
    maxRounds: game.maxRounds ?? 10,
    playMode: game.playMode ?? "INDIVIDUAL",
    teamCount: game.teamCount ?? 2,
  };
}
