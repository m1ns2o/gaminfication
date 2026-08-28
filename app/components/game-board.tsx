"use client";

import { BookOpen, Coffee, Flag, Gift, Sparkles, Zap } from "lucide-react";
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
};

const tileIcons = { START: Flag, QUIZ: BookOpen, BONUS: Gift, EVENT: Zap, REST: Coffee };
const dicePips: Record<number, number[]> = {
  1: [5],
  2: [1, 9],
  3: [1, 5, 9],
  4: [1, 3, 7, 9],
  5: [1, 3, 5, 7, 9],
  6: [1, 3, 4, 6, 7, 9],
};
const tileArrivalCopy: Record<TileType, string> = {
  START: "출발점에 도착했습니다",
  QUIZ: "퀴즈가 열립니다",
  BONUS: "보너스 카드를 확인하세요",
  EVENT: "이벤트 카드가 발동합니다",
  REST: "잠깐 쉬어가는 칸입니다",
};

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function followLineTile(scrollRegion: HTMLDivElement | null, tileIndex: number, behavior: ScrollBehavior) {
  const tile = scrollRegion?.querySelector<HTMLElement>(`[data-tile-index="${tileIndex}"]`);
  if (!scrollRegion || !tile) return;
  const left = tile.offsetLeft - (scrollRegion.clientWidth - tile.clientWidth) / 2;
  scrollRegion.scrollTo({ left: Math.max(0, left), behavior });
}

function DiceFace({ value, side }: { value: number; side: string }) {
  const pips = new Set(dicePips[value]);
  return (
    <span className={`dice-cube__side dice-cube__side--${side}`} aria-hidden="true">
      {Array.from({ length: 9 }, (_, index) => <i key={index} className={pips.has(index + 1) ? "is-visible" : ""} />)}
    </span>
  );
}

function Dice({ value, rolling }: { value: number; rolling: boolean }) {
  return (
    <span className="dice-scene" aria-hidden="true">
      <span className={`dice-cube${rolling ? " is-rolling" : ""}`} data-face={value}>
        <DiceFace value={1} side="front" />
        <DiceFace value={2} side="right" />
        <DiceFace value={3} side="top" />
        <DiceFace value={4} side="bottom" />
        <DiceFace value={5} side="left" />
        <DiceFace value={6} side="back" />
      </span>
    </span>
  );
}

function TokenMark({ token, moving }: { token: Token; moving: boolean }) {
  const glyph = { book: "B", bulb: "L", compass: "C", leaf: "E", rocket: "R" }[token.symbol];
  return (
    <span
      className={`token token--${token.symbol}${token.active ? " token--active" : ""}${moving ? " is-moving" : ""}`}
      title={token.label}
      aria-label={`${token.label}${token.active ? ", 현재 차례" : ""}`}
    >
      {glyph}
    </span>
  );
}

function BoardTileView({ tile, tokens, movingTokenId, currentStep, landed }: {
  tile: BoardTile;
  tokens: Token[];
  movingTokenId: string | null;
  currentStep: boolean;
  landed: boolean;
}) {
  const Icon = tileIcons[tile.type];
  const visible = tokens.slice(0, 3);
  const overflow = Math.max(0, tokens.length - visible.length);
  return (
    <div
      data-tile-index={tile.index}
      className={`board-tile board-tile--${tile.type.toLowerCase()}${tile.index === 23 ? " board-tile--finish" : ""}${currentStep ? " is-current-step" : ""}${landed ? " is-landed" : ""}`}
      style={{ gridColumn: tile.x + 1, gridRow: tile.y + 1 }}
      aria-label={`${tile.index + 1}번 칸, ${tile.label}${landed ? ", 방금 도착" : ""}`}
    >
      <span className="board-tile__number">{String(tile.index + 1).padStart(2, "0")}</span>
      <Icon className="board-tile__icon" aria-hidden="true" strokeWidth={2.2} />
      <span className="board-tile__label">{tile.label}</span>
      {tokens.length > 0 ? (
        <span className="token-stack">
          {visible.map((token) => <TokenMark key={token.id} token={token} moving={token.id === movingTokenId} />)}
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
}: GameBoardProps) {
  const geometry = boardGeometries[geometryId];
  const [displayedPositions, setDisplayedPositions] = useState<Record<string, number>>(() => Object.fromEntries(tokens.map((token) => [token.id, token.position])));
  const [rolling, setRolling] = useState(false);
  const [movingTokenId, setMovingTokenId] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<number | null>(null);
  const [landedIndex, setLandedIndex] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const positionsRef = useRef(displayedPositions);
  const rollEndAtRef = useRef(0);
  const rollTimerRef = useRef<number | null>(null);
  const motionGenerationRef = useRef(0);
  const motionInFlightRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
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

  function beginDiceRoll(duration = 720) {
    if (rollTimerRef.current !== null) window.clearTimeout(rollTimerRef.current);
    rollEndAtRef.current = Date.now() + duration;
    setRolling(true);
    setLandedIndex(null);
    setAnnouncement("주사위를 굴리고 있습니다.");
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
    beginDiceRoll(reducedMotion ? 120 : 720);
    navigator.vibrate?.(18);
    onRoll();
  }

  useEffect(() => () => {
    if (rollTimerRef.current !== null) window.clearTimeout(rollTimerRef.current);
    motionGenerationRef.current += 1;
  }, []);

  useEffect(() => {
    if (compact || geometryId !== "LINE_24") return;
    const frame = window.requestAnimationFrame(() => {
      const activeToken = tokensRef.current.find((token) => token.active) ?? tokensRef.current[0];
      if (activeToken) followLineTile(scrollRef.current, activeToken.position, "auto");
    });
    return () => window.cancelAnimationFrame(frame);
  }, [compact, geometryId]);

  useEffect(() => {
    if (compact) return;
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
      if (reducedMotion) {
        const next = { ...positionsRef.current, [changedToken.id]: changedToken.position };
        positionsRef.current = next;
        setDisplayedPositions(next);
        if (geometryId === "LINE_24") followLineTile(scrollRef.current, changedToken.position, "auto");
      } else {
        if (rollEndAtRef.current <= Date.now()) beginDiceRoll(720);
        await wait(Math.max(0, rollEndAtRef.current - Date.now()));
        if (generation !== motionGenerationRef.current) return;
        setRolling(false);
        for (const position of path) {
          if (generation !== motionGenerationRef.current) return;
          const next = { ...positionsRef.current, [changedToken.id]: position };
          positionsRef.current = next;
          setDisplayedPositions(next);
          setCurrentStep(position);
          if (geometryId === "LINE_24") followLineTile(scrollRef.current, position, "smooth");
          await wait(180);
        }
      }
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
  }, [compact, geometry, geometryId, movement?.actorId, movement?.cardDirection, movement?.from, movement?.key, movement?.rollTo, targetSignature]);

  const displayedTokens = compact ? tokens : tokens.map((token) => ({ ...token, position: displayedPositions[token.id] ?? token.position }));
  const landedType = landedIndex === null ? null : tileTypes?.[landedIndex] ?? geometry.tiles[landedIndex].type;
  const board = (
    <div className={`game-board game-board--${geometryId.toLowerCase()} game-board--${skinId.toLowerCase()}${compact ? " game-board--compact" : ""}`} style={{ aspectRatio: geometry.aspectRatio, gridTemplateColumns: `repeat(${geometry.columns}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${geometry.rows}, minmax(0, 1fr))` }}>
      {geometry.tiles.map((baseTile) => {
        const type = tileTypes?.[baseTile.index] ?? baseTile.type;
        const tile = type === baseTile.type ? baseTile : { ...baseTile, type, label: tileTypeLabels[type] };
        return <BoardTileView key={tile.index} tile={tile} tokens={displayedTokens.filter((token) => token.position === tile.index)} movingTokenId={movingTokenId} currentStep={currentStep === tile.index} landed={landedIndex === tile.index} />;
      })}
      {geometryId === "LOOP_24" ? (
        <div className="board-stage">
          <div className="landmark landmark--left" aria-hidden="true" />
          <div className="landmark landmark--right" aria-hidden="true" />
          <div className="board-stage__copy"><span className="mono-label">ROUND {round}</span><strong>{currentTurnLabel} 차례</strong><span>{eventLabel}</span></div>
          <Sparkles className="stage-spark" aria-hidden="true" />
        </div>
      ) : null}
    </div>
  );

  return (
    <section className={`game-board-frame${compact ? " game-board-frame--compact" : ""}`} aria-label={`${skinNames[skinId]} ${geometry.name} 보드`}>
      {geometryId === "LINE_24" && !compact ? (
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- keyboard users need a focusable horizontal scroll region.
        <div ref={scrollRef} className="game-board-scroll" role="region" aria-label="일직선 보드 좌우 스크롤" tabIndex={0}>{board}</div>
      ) : board}
      {!compact ? (
        <div className="board-console" data-state={rolling ? "rolling" : movingTokenId ? "moving" : landedType ? "arrived" : "idle"}>
          <div className="board-console__status"><span className="mono-label">ROUND {round}</span><strong>{rolling ? "주사위를 굴리는 중" : movingTokenId ? `${currentStep !== null ? currentStep + 1 : ""}번 칸으로 이동 중` : `${currentTurnLabel} 차례`}</strong><span>{landedType ? `${tileTypeLabels[landedType]} 칸 도착 · ${tileArrivalCopy[landedType]}` : eventLabel}</span></div>
          <button className="dice-button" type="button" onClick={handleRoll} disabled={!onRoll || rolling || Boolean(movingTokenId)} aria-label={rolling ? "주사위 굴리는 중" : "주사위 굴리기"} aria-busy={rolling} data-state={rolling ? "loading" : landedType ? "success" : "default"}>
            <Dice value={lastRoll} rolling={rolling} />
            <span>{rolling ? "굴리는 중" : movingTokenId ? "이동 중" : "주사위 굴리기"}</span>
          </button>
        </div>
      ) : null}
      <span className="sr-only" aria-live="polite">{announcement}</span>
    </section>
  );
}
