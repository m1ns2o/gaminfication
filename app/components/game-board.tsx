"use client";
import "../studio.css";

import { BookOpen, Check, Coffee, Dices, Flag, Gift, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  boardGeometries,
  boardStepPath,
  skinNames,
  tileTypeLabels,
  type BoardGeometryId,
  type BoardTile,
  type SkinId,
  type TileType,
} from "../lib/board";
import { PhysicsDie } from "./physics-die";

type Token = {
  id: string;
  label: string;
  position: number;
  symbol: "book" | "bulb" | "compass" | "leaf" | "rocket";
  active?: boolean;
};

export type BoardMovement = {
  key: string | number;
  actorId?: string;
  from?: number;
  rollTo?: number;
  cardDirection?: 1 | -1;
};

export type BoardTileMark = {
  index: number;
  kind: "question" | "card";
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
  movement?: BoardMovement;
  onMovementComplete?: (arrival: { position: number; tileType: TileType }) => void;
  onAnimationStateChange?: (animating: boolean) => void;
  /** 스튜디오 맵 편집 모드 — 토큰·주사위 없이 칸을 눌러 선택합니다. */
  editMode?: boolean;
  selectedTileIndex?: number | null;
  onTileClick?: (index: number) => void;
  /** 편집 모드에서 실제로 눌러 선택할 수 있는 칸(문제/카드 섹션용). undefined면 전부 가능. */
  clickableTileIndexes?: number[] | null;
  /** 편집 모드에서 칸 위에 표시할 콘텐츠 표식 (문제·카드 지정됨). */
  tileMarks?: BoardTileMark[];
};

const tileIcons = { START: Flag, QUIZ: BookOpen, BONUS: Gift, EVENT: Zap, REST: Coffee };
const DICE_MOTION_DURATION = 3200;
const DICE_RESULT_HOLD_DURATION = 1300;
const DICE_ROLL_DURATION = DICE_MOTION_DURATION + DICE_RESULT_HOLD_DURATION;
const REDUCED_DICE_MOTION_DURATION = 2000;
const REDUCED_DICE_RESULT_HOLD_DURATION = 1300;
const TOKEN_STEP_DURATION = 600;
const REDUCED_TOKEN_STEP_DURATION = 360;

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function TokenMark({ token, moving = false }: { token: Token; moving?: boolean }) {
  const glyph = { book: "B", bulb: "L", compass: "C", leaf: "E", rocket: "R" }[token.symbol];
  return (
    <span
      className={`token token--${token.symbol}${token.active ? " token--active" : ""}${moving ? " is-moving" : ""}`}
      title={token.label}
      aria-label={`${token.label}${token.active ? ", 현재 차례" : ""}`}
    >
      <span className="token__base" aria-hidden="true" />
      <span className="token__avatar" aria-hidden="true" />
      <span className="token__initial" aria-hidden="true">{glyph}</span>
    </span>
  );
}

function BoardScenery({ skinId }: { skinId: SkinId }) {
  return (
    <div className={`board-scenery board-scenery--${skinId.toLowerCase()}`} aria-hidden="true">
      <span className="board-scenery__ground" />
      <span className="board-scenery__item board-scenery__item--one" />
      <span className="board-scenery__item board-scenery__item--two" />
      <span className="board-scenery__item board-scenery__item--three" />
      <span className="board-scenery__item board-scenery__item--four" />
    </div>
  );
}

function BoardTileView({ tile, tokens, currentStep, landed, selected, onClick, clickable = false, mark }: {
  tile: BoardTile;
  tokens: Token[];
  currentStep: boolean;
  landed: boolean;
  selected?: boolean;
  onClick?: (index: number) => void;
  clickable?: boolean;
  mark?: BoardTileMark;
}) {
  const Icon = tileIcons[tile.type];
  const visible = tokens.slice(0, 3);
  const overflow = Math.max(0, tokens.length - visible.length);
  return (
    <div
      data-tile-index={tile.index}
      className={`board-tile board-tile--${tile.type.toLowerCase()}${tile.index === 23 ? " board-tile--finish" : ""}${currentStep ? " is-current-step" : ""}${landed ? " is-landed" : ""}${selected ? " is-selected" : ""}${clickable ? " is-clickable" : ""}${mark ? ` has-mark has-mark--${mark.kind}` : ""}`}
      style={{ gridColumn: tile.x + 1, gridRow: tile.y + 1 }}
      role={onClick && clickable ? "button" : undefined}
      tabIndex={onClick && clickable ? 0 : undefined}
      aria-label={`${tile.index + 1}번 칸, ${tile.label}${selected ? ", 선택됨" : ""}${onClick && clickable ? ", 편집하려면 누르세요" : ""}`}
      onClick={onClick && clickable ? () => onClick(tile.index) : undefined}
      onKeyDown={onClick && clickable ? (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick(tile.index);
        }
      } : undefined}
    >
      <span className="board-tile__number">{String(tile.index + 1).padStart(2, "0")}</span>
      <Icon className="board-tile__icon" aria-hidden="true" strokeWidth={2.2} />
      <span className="board-tile__label">{tile.label}</span>
      {mark ? <span className={`board-tile__mark board-tile__mark--${mark.kind}`} title={mark.kind === "question" ? "문제 지정됨" : "카드 지정됨"}><Check aria-hidden="true" /></span> : null}
      {tokens.length > 0 ? (
        <span className="token-stack">
          {visible.map((token) => <TokenMark key={token.id} token={token} />)}
          {overflow > 0 ? <span className="token-overflow">+{overflow}</span> : null}
        </span>
      ) : null}
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
  movement,
  onMovementComplete,
  onAnimationStateChange,
  editMode = false,
  selectedTileIndex = null,
  onTileClick,
  clickableTileIndexes,
  tileMarks,
}: GameBoardProps) {
  const geometry = boardGeometries[geometryId];
  const [displayedPositions, setDisplayedPositions] = useState<Record<string, number>>(() => Object.fromEntries(tokens.map((token) => [token.id, token.position])));
  const [rolling, setRolling] = useState(false);
  const [rollPhase, setRollPhase] = useState<"rolling" | "result">("rolling");
  const [rollCycle, setRollCycle] = useState(0);
  const [movingTokenId, setMovingTokenId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<number | null>(null);
  const [landedIndex, setLandedIndex] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const positionsRef = useRef(displayedPositions);
  const rollEndAtRef = useRef(0);
  const rollTimerRef = useRef<number | null>(null);
  const rollResultTimerRef = useRef<number | null>(null);
  const motionGenerationRef = useRef(0);
  const motionInFlightRef = useRef(false);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const movingTokenRef = useRef<HTMLSpanElement | null>(null);
  const tokensRef = useRef(tokens);
  const tileTypesRef = useRef(tileTypes);
  const completionRef = useRef(onMovementComplete);
  const animationStateRef = useRef(onAnimationStateChange);
  const targetSignature = tokens.map((token) => `${token.id}:${token.position}`).join("|");

  useEffect(() => {
    tokensRef.current = tokens;
    tileTypesRef.current = tileTypes;
    completionRef.current = onMovementComplete;
    animationStateRef.current = onAnimationStateChange;
  }, [onAnimationStateChange, onMovementComplete, tileTypes, tokens]);

  function beginDiceRoll(reducedMotion = false) {
    if (rollTimerRef.current !== null) window.clearTimeout(rollTimerRef.current);
    if (rollResultTimerRef.current !== null) window.clearTimeout(rollResultTimerRef.current);
    const motionDuration = reducedMotion ? REDUCED_DICE_MOTION_DURATION : DICE_MOTION_DURATION;
    const duration = reducedMotion ? REDUCED_DICE_MOTION_DURATION + REDUCED_DICE_RESULT_HOLD_DURATION : DICE_ROLL_DURATION;
    rollEndAtRef.current = Date.now() + duration;
    setRollCycle((current) => current + 1);
    setRolling(true);
    setRollPhase("rolling");
    setLandedIndex(null);
    setAnnouncement("주사위를 굴리고 있습니다.");
    rollResultTimerRef.current = window.setTimeout(() => {
      setRollPhase("result");
      setAnnouncement("주사위 결과가 나왔습니다.");
      rollResultTimerRef.current = null;
    }, motionDuration);
    rollTimerRef.current = window.setTimeout(() => {
      setRolling(false);
      rollTimerRef.current = null;
      if (!motionInFlightRef.current) animationStateRef.current?.(false);
    }, duration);
  }

  function handleRoll() {
    if (!onRoll || rolling || movingTokenId) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    animationStateRef.current?.(true);
    beginDiceRoll(reducedMotion);
    navigator.vibrate?.(18);
    onRoll();
  }

  useEffect(() => () => {
    if (rollTimerRef.current !== null) window.clearTimeout(rollTimerRef.current);
    if (rollResultTimerRef.current !== null) window.clearTimeout(rollResultTimerRef.current);
    motionGenerationRef.current += 1;
  }, []);

  useEffect(() => {
    if (compact || editMode) return;
    const currentTokens = tokensRef.current;
    const changed = currentTokens.find((token) => positionsRef.current[token.id] !== undefined && positionsRef.current[token.id] !== token.position);
    const added = currentTokens.filter((token) => positionsRef.current[token.id] === undefined);
    if (added.length > 0) {
      const next = { ...positionsRef.current };
      for (const token of added) next[token.id] = token.position;
      positionsRef.current = next;
    }
    if (!changed) return;
    const changedToken = changed;

    const generation = ++motionGenerationRef.current;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const from = movement?.actorId === changedToken.id && movement.from !== undefined ? movement.from : positionsRef.current[changedToken.id];
    const rollTo = movement?.actorId === changedToken.id && movement.rollTo !== undefined ? movement.rollTo : changedToken.position;
    const firstLeg = boardStepPath(geometryId, from, rollTo, rollTo >= from || geometry.wraps ? 1 : -1);
    const secondLeg = rollTo === changedToken.position ? [] : boardStepPath(geometryId, rollTo, changedToken.position, movement?.cardDirection ?? (changedToken.position >= rollTo ? 1 : -1));
    const path = [...firstLeg, ...secondLeg];

    async function animateMove() {
      motionInFlightRef.current = true;
      animationStateRef.current?.(true);
      setMovingTokenId(changedToken.id);
      setLandedIndex(null);
      if (rollEndAtRef.current <= Date.now()) beginDiceRoll(reducedMotion);
      await wait(Math.max(0, rollEndAtRef.current - Date.now()));
      if (generation !== motionGenerationRef.current) return;
      setRolling(false);
      await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
      const movingElement = movingTokenRef.current;
      const boardElement = boardRef.current;
      const tilePoint = (position: number) => {
        const tile = boardElement?.querySelector<HTMLElement>(`[data-tile-index="${position}"]`);
        if (!tile) return null;
        return { x: tile.offsetLeft + tile.offsetWidth / 2, y: tile.offsetTop + tile.offsetHeight / 2 };
      };
      if (reducedMotion) {
        const initialPoint = tilePoint(from);
        if (movingElement && initialPoint) {
          movingElement.style.left = `${initialPoint.x}px`;
          movingElement.style.top = `${initialPoint.y}px`;
          movingElement.classList.add("is-ready");
        }
        for (const position of path) {
          if (generation !== motionGenerationRef.current) return;
          const point = tilePoint(position);
          setCurrentStep(position);
          if (movingElement && point) {
            movingElement.style.left = `${point.x}px`;
            movingElement.style.top = `${point.y}px`;
          }
          await wait(REDUCED_TOKEN_STEP_DURATION);
        }
      } else {
        let visualPosition = from;
        const initialPoint = tilePoint(visualPosition);
        if (movingElement && initialPoint) {
          movingElement.style.left = `${initialPoint.x}px`;
          movingElement.style.top = `${initialPoint.y}px`;
          movingElement.classList.add("is-ready");
        }
        for (const position of path) {
          if (generation !== motionGenerationRef.current) return;
          const startPoint = tilePoint(visualPosition);
          const endPoint = tilePoint(position);
          setCurrentStep(position);
          if (movingElement && startPoint && endPoint) {
            movingElement.style.left = `${endPoint.x}px`;
            movingElement.style.top = `${endPoint.y}px`;
            const deltaX = startPoint.x - endPoint.x;
            const deltaY = startPoint.y - endPoint.y;
            const hopHeight = Math.max(22, Math.min(42, Math.hypot(deltaX, deltaY) * 0.34));
            const animation = movingElement.animate([
              { transform: `translate3d(${deltaX}px, ${deltaY}px, 0) translate(-50%, -68%) scale(1)` },
              { transform: `translate3d(${deltaX * 0.5}px, ${deltaY * 0.5 - hopHeight}px, 0) translate(-50%, -68%) rotate(-5deg) scale(1.16)`, offset: 0.48 },
              { transform: "translate3d(0, 0, 0) translate(-50%, -68%) scale(1)" },
            ], { duration: TOKEN_STEP_DURATION, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "both" });
            await animation.finished.catch(() => undefined);
          } else {
            await wait(TOKEN_STEP_DURATION);
          }
          visualPosition = position;
        }
      }
      const next = { ...positionsRef.current, [changedToken.id]: changedToken.position };
      positionsRef.current = next;
      setDisplayedPositions(next);
      if (generation !== motionGenerationRef.current) return;
      setCurrentStep(null);
      setMovingTokenId(null);
      setLandedIndex(changedToken.position);
      const tileType = tileTypesRef.current?.[changedToken.position] ?? geometry.tiles[changedToken.position].type;
      setAnnouncement(`${changedToken.label} 말이 ${changedToken.position + 1}번 ${tileTypeLabels[tileType]} 칸에 도착했습니다.`);
      motionInFlightRef.current = false;
      animationStateRef.current?.(false);
      completionRef.current?.({ position: changedToken.position, tileType });
    }

    const startTimer = window.setTimeout(() => void animateMove(), 0);
    return () => {
      window.clearTimeout(startTimer);
      if (generation === motionGenerationRef.current) {
        motionGenerationRef.current += 1;
        motionInFlightRef.current = false;
        animationStateRef.current?.(false);
      }
    };
  }, [compact, editMode, geometry, geometryId, movement?.actorId, movement?.cardDirection, movement?.from, movement?.key, movement?.rollTo, targetSignature]);

  const displayedTokens = editMode ? [] : compact ? tokens : tokens.map((token) => ({ ...token, position: displayedPositions[token.id] ?? token.position }));
  const movingToken = !editMode && movingTokenId ? displayedTokens.find((token) => token.id === movingTokenId) ?? null : null;
  const landedType = landedIndex === null ? null : tileTypes?.[landedIndex] ?? geometry.tiles[landedIndex].type;
  const rollControl = !compact && !editMode && onRoll ? (
    <div className="board-roll-control">
      <button className="dice-button" type="button" onClick={handleRoll} disabled={!onRoll || rolling || Boolean(movingTokenId)} aria-label={rolling ? "주사위 굴리는 중" : "주사위 굴리기"} aria-busy={rolling} data-state={rolling ? "loading" : landedType ? "success" : "default"}>
        <Dices aria-hidden="true" />
        <span>{rolling ? "굴리는 중" : movingTokenId ? "이동 중" : "주사위 굴리기"}</span>
      </button>
    </div>
  ) : null;
  const diceOverlay = rolling && !compact && !editMode ? (
    <div className="dice-roll-overlay" role="status" aria-label={rollPhase === "result" ? `주사위 결과 ${lastRoll}` : "주사위를 굴리는 중"} data-phase={rollPhase}>
      <PhysicsDie value={lastRoll} rollKey={rollCycle} phase={rollPhase} />
      <strong>{rollPhase === "result" ? <>주사위 결과 <b>{lastRoll}</b></> : "주사위가 굴러갑니다"}</strong>
    </div>
  ) : null;
  const selectedTileType = editMode && selectedTileIndex != null ? tileTypes?.[selectedTileIndex] ?? geometry.tiles[selectedTileIndex].type : null;
  const board = (
    <div ref={boardRef} className={`game-board game-board--${geometryId.toLowerCase()} game-board--${skinId.toLowerCase()} game-board--view-2d${compact ? " game-board--compact" : ""}${editMode ? " game-board--edit" : ""}`} style={{ aspectRatio: geometry.aspectRatio, gridTemplateColumns: `repeat(${geometry.columns}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${geometry.rows}, minmax(0, 1fr))` }}>
      {geometry.tiles.map((baseTile) => {
        const type = tileTypes?.[baseTile.index] ?? baseTile.type;
        const tile = type === baseTile.type ? baseTile : { ...baseTile, type, label: tileTypeLabels[type] };
        const clickable = editMode && (!clickableTileIndexes || clickableTileIndexes.includes(tile.index));
        const mark = editMode ? tileMarks?.find((candidate) => candidate.index === tile.index) : undefined;
        return <BoardTileView key={tile.index} tile={tile} tokens={displayedTokens.filter((token) => token.id !== movingTokenId && token.position === tile.index)} currentStep={currentStep === tile.index} landed={landedIndex === tile.index} selected={editMode && selectedTileIndex === tile.index} onClick={editMode ? onTileClick : undefined} clickable={clickable} mark={mark} />;
      })}
      <div className="board-stage">
        <BoardScenery skinId={skinId} />
        <div className={`board-stage__copy${editMode ? " board-stage__copy--edit" : ""}`}>
          {editMode ? (
            <>
              <span className="mono-label">MAP STUDIO</span>
              <strong>{selectedTileIndex != null && selectedTileType ? `${selectedTileIndex + 1}번 · ${tileTypeLabels[selectedTileType]}` : "맵 미리보기"}</strong>
              <span>{selectedTileIndex != null ? "아래에서 유형 변경" : "칸을 눌러 선택"}</span>
            </>
          ) : (
            <>
              <span className="mono-label">ROUND {round}</span>
              <strong>{currentTurnLabel} 차례</strong>
              <span>{eventLabel}</span>
            </>
          )}
        </div>
      </div>
      {movingToken ? <span ref={movingTokenRef} className="moving-token"><TokenMark token={movingToken} moving /></span> : null}
      {rollControl}
      {diceOverlay}
    </div>
  );

  return (
    <section className={`game-board-frame game-board-frame--2d${compact ? " game-board-frame--compact" : ""}`} aria-label={`${skinNames[skinId]} ${geometry.name} 평면 보드`} data-view-mode="2D">
      <div className="game-board-visual">
        {board}
      </div>
      <span className="sr-only" aria-live="polite">{announcement}</span>
    </section>
  );
}
