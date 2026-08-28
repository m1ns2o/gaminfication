import {
  BookOpen,
  Coffee,
  Flag,
  Gift,
  Sparkles,
  Zap,
} from "lucide-react";
import {
  boardGeometries,
  skinNames,
  tileTypeLabels,
  type BoardGeometryId,
  type BoardTile,
  type SkinId,
  type TileType,
} from "../lib/board";

type Token = {
  id: string;
  label: string;
  position: number;
  symbol: "book" | "bulb" | "compass" | "leaf" | "rocket";
  active?: boolean;
};

type GameBoardProps = {
  geometryId: BoardGeometryId;
  skinId: SkinId;
  tokens: Token[];
  round: number;
  lastRoll: number;
  onRoll?: () => void;
  compact?: boolean;
  currentTurnLabel?: string;
  eventLabel?: string;
  tileTypes?: TileType[];
};

const tileIcons = {
  START: Flag,
  QUIZ: BookOpen,
  BONUS: Gift,
  EVENT: Zap,
  REST: Coffee,
};

function TokenMark({ token }: { token: Token }) {
  const glyph = {
    book: "B",
    bulb: "L",
    compass: "C",
    leaf: "E",
    rocket: "R",
  }[token.symbol];

  return (
    <span
      className={`token token--${token.symbol}${token.active ? " token--active" : ""}`}
      title={token.label}
      aria-label={`${token.label}${token.active ? ", 현재 차례" : ""}`}
    >
      {glyph}
    </span>
  );
}

function BoardTileView({ tile, tokens }: { tile: BoardTile; tokens: Token[] }) {
  const Icon = tileIcons[tile.type];
  const visible = tokens.slice(0, 3);
  const overflow = Math.max(0, tokens.length - visible.length);

  return (
    <div
      className={`board-tile board-tile--${tile.type.toLowerCase()}`}
      style={{ gridColumn: tile.x + 1, gridRow: tile.y + 1 }}
      aria-label={`${tile.index + 1}번 칸, ${tile.label}`}
    >
      <span className="board-tile__number">{String(tile.index + 1).padStart(2, "0")}</span>
      <Icon className="board-tile__icon" aria-hidden="true" strokeWidth={2.2} />
      <span className="board-tile__label">{tile.label}</span>
      {tokens.length > 0 && (
        <span className="token-stack">
          {visible.map((token) => <TokenMark key={token.id} token={token} />)}
          {overflow > 0 && <span className="token-overflow">+{overflow}</span>}
        </span>
      )}
    </div>
  );
}

export function GameBoard({
  geometryId,
  skinId,
  tokens,
  round,
  lastRoll,
  onRoll,
  compact = false,
  currentTurnLabel = "김하늘 팀",
  eventLabel = "퀴즈와 카드로 학습하기",
  tileTypes,
}: GameBoardProps) {
  const geometry = boardGeometries[geometryId];
  const isLoop = geometryId === "LOOP_24";

  return (
    <section
      className={`game-board game-board--${geometryId.toLowerCase()} game-board--${skinId.toLowerCase()}${compact ? " game-board--compact" : ""}`}
      aria-label={`${skinNames[skinId]} ${geometryId === "LOOP_24" ? "순환형" : "직선 레이스"} 보드`}
      style={{
        gridTemplateColumns: `repeat(${geometry.columns}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${geometry.rows}, minmax(0, 1fr))`,
      }}
    >
      {geometry.tiles.map((baseTile) => {
        const type = tileTypes?.[baseTile.index] ?? baseTile.type;
        const tile = type === baseTile.type ? baseTile : { ...baseTile, type, label: tileTypeLabels[type] };
        return (
        <BoardTileView
          key={tile.index}
          tile={tile}
          tokens={tokens.filter((token) => token.position === tile.index)}
        />
        );
      })}

      {isLoop && (
        <div className="board-stage">
          <div className="landmark landmark--left" aria-hidden="true" />
          <div className="landmark landmark--right" aria-hidden="true" />
          <div className="board-stage__copy">
            <span className="mono-label">ROUND {round}</span>
            <strong>{currentTurnLabel} 차례</strong>
            <span>{eventLabel}</span>
          </div>
          <button
            className="dice-button"
            type="button"
            onClick={onRoll}
            disabled={!onRoll}
            aria-label="주사위 굴리기"
          >
            <span className="dice-button__face" aria-hidden="true">{lastRoll}</span>
            <span>굴리기</span>
          </button>
          <Sparkles className="stage-spark" aria-hidden="true" />
        </div>
      )}
    </section>
  );
}
