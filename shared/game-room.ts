import type { BoardGeometryId, SkinId } from "../app/lib/board";

export const MAX_ROOM_PLAYERS = 40;

export type RoomStatus = "LOBBY" | "PLAYING" | "FINALIZED";
export type PlayerRole = "HOST" | "PLAYER";
export type PlayerSymbol = "book" | "bulb" | "compass" | "leaf" | "rocket";

export type RoomPlayer = {
  id: string;
  nickname: string;
  role: PlayerRole;
  symbol: PlayerSymbol;
  connected: boolean;
  position: number;
  score: number;
  joinedAt: string;
};

export type RoomEvent = {
  type: "ROOM_CREATED" | "PLAYER_JOINED" | "PLAYER_CONNECTION_CHANGED" | "GAME_STARTED" | "DICE_ROLLED";
  at: string;
  actorId?: string;
  dice?: number;
  from?: number;
  to?: number;
};

export type GameRoomState = {
  roomId: string;
  code: string;
  gameId: string;
  gameTitle: string;
  template: BoardGeometryId;
  skin: SkinId;
  status: RoomStatus;
  version: number;
  round: number;
  turnIndex: number;
  currentPlayerId: string | null;
  lastRoll: number;
  players: RoomPlayer[];
  lastEvent: RoomEvent;
  updatedAt: string;
};

export type CreateRoomInput = Pick<
  GameRoomState,
  "roomId" | "code" | "gameId" | "gameTitle" | "template" | "skin"
> & {
  host: Pick<RoomPlayer, "id" | "nickname">;
  now?: string;
};

export type AddPlayerInput = Pick<RoomPlayer, "id" | "nickname"> & {
  role?: PlayerRole;
  now?: string;
};

export type ClientRoomMessage =
  | { type: "SYNC" }
  | { type: "START_GAME"; actionId: string; expectedVersion?: number }
  | { type: "ROLL_DICE"; actionId: string; expectedVersion?: number };

export type ServerRoomMessage =
  | { type: "ROOM_STATE"; state: GameRoomState }
  | { type: "ROOM_ERROR"; code: string; message: string; state?: GameRoomState };

const playerSymbols: PlayerSymbol[] = ["book", "bulb", "compass", "leaf", "rocket"];

export class GameRuleError extends Error {
  readonly code: string;

  constructor(
    code: string,
    message: string,
  ) {
    super(message);
    this.name = "GameRuleError";
    this.code = code;
  }
}

function nextVersion(state: GameRoomState, event: RoomEvent): GameRoomState {
  return {
    ...state,
    version: state.version + 1,
    lastEvent: event,
    updatedAt: event.at,
  };
}

function assertVersion(state: GameRoomState, expectedVersion?: number) {
  if (expectedVersion !== undefined && expectedVersion !== state.version) {
    throw new GameRuleError("STALE_STATE", "게임 상태가 변경되었습니다. 최신 상태에서 다시 시도하세요.");
  }
}

export function createRoomState(input: CreateRoomInput): GameRoomState {
  const now = input.now ?? new Date().toISOString();
  const host: RoomPlayer = {
    id: input.host.id,
    nickname: input.host.nickname,
    role: "HOST",
    symbol: playerSymbols[0],
    connected: false,
    position: 0,
    score: 0,
    joinedAt: now,
  };

  return {
    roomId: input.roomId,
    code: input.code,
    gameId: input.gameId,
    gameTitle: input.gameTitle,
    template: input.template,
    skin: input.skin,
    status: "LOBBY",
    version: 1,
    round: 1,
    turnIndex: 0,
    currentPlayerId: host.id,
    lastRoll: 1,
    players: [host],
    lastEvent: { type: "ROOM_CREATED", at: now, actorId: host.id },
    updatedAt: now,
  };
}

export function addPlayer(state: GameRoomState, input: AddPlayerInput): GameRoomState {
  const existing = state.players.find((player) => player.id === input.id);
  if (existing) return state;
  if (state.status !== "LOBBY") {
    throw new GameRuleError("GAME_ALREADY_STARTED", "이미 시작된 게임에는 새로 참가할 수 없습니다.");
  }
  if (state.players.length >= MAX_ROOM_PLAYERS) {
    throw new GameRuleError("ROOM_FULL", "참가 가능한 인원을 모두 채웠습니다.");
  }

  const now = input.now ?? new Date().toISOString();
  const player: RoomPlayer = {
    id: input.id,
    nickname: input.nickname,
    role: input.role ?? "PLAYER",
    symbol: playerSymbols[state.players.length % playerSymbols.length],
    connected: false,
    position: 0,
    score: 0,
    joinedAt: now,
  };

  return nextVersion(
    { ...state, players: [...state.players, player] },
    { type: "PLAYER_JOINED", at: now, actorId: player.id },
  );
}

export function setPlayerConnected(
  state: GameRoomState,
  playerId: string,
  connected: boolean,
  now = new Date().toISOString(),
): GameRoomState {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (!player) throw new GameRuleError("PLAYER_NOT_FOUND", "참가자를 찾을 수 없습니다.");
  if (player.connected === connected) return state;

  return nextVersion(
    {
      ...state,
      players: state.players.map((candidate) => (
        candidate.id === playerId ? { ...candidate, connected } : candidate
      )),
    },
    { type: "PLAYER_CONNECTION_CHANGED", at: now, actorId: playerId },
  );
}

export function startGame(
  state: GameRoomState,
  actorId: string,
  expectedVersion?: number,
  now = new Date().toISOString(),
): GameRoomState {
  assertVersion(state, expectedVersion);
  const actor = state.players.find((player) => player.id === actorId);
  if (actor?.role !== "HOST") throw new GameRuleError("HOST_ONLY", "진행자만 게임을 시작할 수 있습니다.");
  if (state.status !== "LOBBY") throw new GameRuleError("INVALID_ROOM_STATUS", "대기 중인 방만 시작할 수 있습니다.");

  return nextVersion(
    { ...state, status: "PLAYING", turnIndex: 0, currentPlayerId: state.players[0]?.id ?? null },
    { type: "GAME_STARTED", at: now, actorId },
  );
}

export function rollDice(
  state: GameRoomState,
  actorId: string,
  dice: number,
  expectedVersion?: number,
  now = new Date().toISOString(),
): GameRoomState {
  assertVersion(state, expectedVersion);
  if (state.status !== "PLAYING") throw new GameRuleError("GAME_NOT_PLAYING", "게임이 아직 시작되지 않았습니다.");
  if (state.currentPlayerId !== actorId) throw new GameRuleError("NOT_YOUR_TURN", "현재 차례가 아닙니다.");
  if (!Number.isInteger(dice) || dice < 1 || dice > 6) throw new GameRuleError("INVALID_DICE", "주사위 값이 올바르지 않습니다.");

  const actor = state.players.find((player) => player.id === actorId);
  if (!actor) throw new GameRuleError("PLAYER_NOT_FOUND", "참가자를 찾을 수 없습니다.");

  const from = actor.position;
  const to = (from + dice) % 24;
  const nextTurnIndex = (state.turnIndex + 1) % state.players.length;
  const round = nextTurnIndex === 0 ? state.round + 1 : state.round;

  return nextVersion(
    {
      ...state,
      round,
      turnIndex: nextTurnIndex,
      currentPlayerId: state.players[nextTurnIndex]?.id ?? null,
      lastRoll: dice,
      players: state.players.map((player) => player.id === actorId ? { ...player, position: to } : player),
    },
    { type: "DICE_ROLLED", at: now, actorId, dice, from, to },
  );
}
