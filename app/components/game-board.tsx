"use client";

import { BookOpen, Coffee, Dices, Flag, Gift, Zap } from "lucide-react";
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
const DICE_MOTION_DURATION = 2600;
const DICE_RESULT_HOLD_DURATION = 1300;
const DICE_ROLL_DURATION = DICE_MOTION_DURATION + DICE_RESULT_HOLD_DURATION;
const REDUCED_DICE_MOTION_DURATION = 1200;
const REDUCED_DICE_RESULT_HOLD_DURATION = 1300;
const TOKEN_STEP_DURATION = 600;
const REDUCED_TOKEN_STEP_DURATION = 360;
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

function TokenMark({ token, moving = false }: { token: Token; moving?: boolean }) {
  const glyph = { book: "B", bulb: "L", compass: "C", leaf: "E", rocket: "R" }[token.symbol];
  return (
    <span
      className={`token token--${token.symbol}${token.active ? " token--active" : ""}${moving ? " is-moving" : ""}`}
      title={token.label}
      aria-label={`${token.label}${token.active ? ", 현재 차례" : ""}`}
    >
      <span className="token__figure" aria-hidden="true"><i /><i /></span>
      <span className="token__initial" aria-hidden="true">{glyph}</span>
    </span>
  );
}

function BoardTileView({ tile, tokens, currentStep, landed }: {
  tile: BoardTile;
  tokens: Token[];
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
  const scrollRef = useRef<HTMLDivElement | null>(null);
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
          if (geometryId === "LINE_24") followLineTile(scrollRef.current, position, "auto");
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
          if (geometryId === "LINE_24") followLineTile(scrollRef.current, position, "smooth");
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
  }, [compact, geometry, geometryId, movement?.actorId, movement?.cardDirection, movement?.from, movement?.key, movement?.rollTo, targetSignature]);

  const displayedTokens = compact ? tokens : tokens.map((token) => ({ ...token, position: displayedPositions[token.id] ?? token.position }));
  const movingToken = movingTokenId ? displayedTokens.find((token) => token.id === movingTokenId) ?? null : null;
  const landedType = landedIndex === null ? null : tileTypes?.[landedIndex] ?? geometry.tiles[landedIndex].type;
  const board = (
    <div ref={boardRef} className={`game-board game-board--${geometryId.toLowerCase()} game-board--${skinId.toLowerCase()}${compact ? " game-board--compact" : ""}`} style={{ aspectRatio: geometry.aspectRatio, gridTemplateColumns: `repeat(${geometry.columns}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${geometry.rows}, minmax(0, 1fr))` }}>
      {geometry.tiles.map((baseTile) => {
        const type = tileTypes?.[baseTile.index] ?? baseTile.type;
        const tile = type === baseTile.type ? baseTile : { ...baseTile, type, label: tileTypeLabels[type] };
        return <BoardTileView key={tile.index} tile={tile} tokens={displayedTokens.filter((token) => token.id !== movingTokenId && token.position === tile.index)} currentStep={currentStep === tile.index} landed={landedIndex === tile.index} />;
      })}
      {geometryId === "LOOP_24" ? (
        <div className="board-stage">
          <div className="toy-town" aria-hidden="true">
            <span className="toy-town__road" />
            <span className="toy-town__school"><i /><i /><i /></span>
            <span className="toy-town__lab"><i /><i /></span>
            <span className="toy-town__tree toy-town__tree--left" />
            <span className="toy-town__tree toy-town__tree--right" />
          </div>
          <div className="board-stage__copy"><span className="mono-label">ROUND {round}</span><strong>{currentTurnLabel} 차례</strong><span>{eventLabel}</span></div>
        </div>
      ) : null}
      {movingToken ? <span ref={movingTokenRef} className="moving-token"><TokenMark token={movingToken} moving /></span> : null}
      {!compact ? (
        <div className="board-roll-control">
          <button className="dice-button" type="button" onClick={handleRoll} disabled={!onRoll || rolling || Boolean(movingTokenId)} aria-label={rolling ? "주사위 굴리는 중" : "주사위 굴리기"} aria-busy={rolling} data-state={rolling ? "loading" : landedType ? "success" : "default"}>
            <Dices aria-hidden="true" />
            <span>{rolling ? "굴리는 중" : movingTokenId ? "이동 중" : "주사위 굴리기"}</span>
          </button>
        </div>
      ) : null}
      {rolling && !compact ? (
        <div className="dice-roll-overlay" role="status" aria-label={rollPhase === "result" ? `주사위 결과 ${lastRoll}` : "주사위를 굴리는 중"} data-phase={rollPhase}>
          <PhysicsDie value={lastRoll} rollKey={rollCycle} />
          <strong>{rollPhase === "result" ? <>주사위 결과 <b>{lastRoll}</b></> : "주사위가 굴러갑니다"}</strong>
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
        </div>
      ) : null}
      <span className="sr-only" aria-live="polite">{announcement}</span>
    </section>
  );
}
