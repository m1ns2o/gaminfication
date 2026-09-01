import type { GameStatus } from "./game-types";

export type View = "dashboard" | "library" | "editor" | "room";
export type EditorSection = "settings" | "tiles" | "questions" | "cards";

export type StudioAuth = {
  user: { displayName: string; email: string } | null;
  signInPath: string;
  signOutPath: string;
};

export function statusText(status: GameStatus) {
  return {
    DRAFT: "초안",
    PUBLISHED: "발행됨",
    PENDING_REVIEW: "심사 중",
  }[status];
}
