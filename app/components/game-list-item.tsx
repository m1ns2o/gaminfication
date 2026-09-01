"use client";
import "../studio.css";

import { Globe2, Grid2X2, Link2, LockKeyhole } from "lucide-react";
import type { Game } from "../lib/game-types";

export function GameListItem({
  game,
  selected,
  onSelect,
}: {
  game: Game;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`game-list-item${selected ? " is-selected" : ""}`}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <span className={`game-list-item__map map-swatch map-swatch--${game.skin.toLowerCase()}`} aria-hidden="true">
        <Grid2X2 />
      </span>
      <span className="game-list-item__copy">
        <strong>{game.title}</strong>
        {game.subject !== "미지정" || game.grade !== "미지정" ? (
          <span>{game.subject} · {game.grade}</span>
        ) : null}
      </span>
      <span className="game-list-item__meta">
        <span className={`status-dot status-dot--${game.status.toLowerCase()}`} />
        {game.visibility === "PUBLIC" ? <Globe2 aria-hidden="true" /> : game.visibility === "UNLISTED" ? <Link2 aria-hidden="true" /> : <LockKeyhole aria-hidden="true" />}
      </span>
    </button>
  );
}
