import type { BoardGeometryId, SkinId } from "../app/lib/board";

export const MAX_ROOM_PLAYERS = 40;

export type RoomStatus = "LOBBY" | "PLAYING" | "FINALIZED";
export type PlayerRole = "HOST" | "PLAYER";
export type PlayerSymbol = "book" | "bulb" | "compass" | "leaf" | "rocket";
export type GamePhase = "WAITING_FOR_ROLL" | "WAITING_FOR_ANSWER";
export type RoomQuestionType = "MULTIPLE_CHOICE" | "SHORT_ANSWER" | "OX";
export type RoomCardEffect = "MOVE_FORWARD" | "MOVE_BACK" | "SCORE_BONUS" | "EXTRA_TURN" | "SKIP_TURN";

export type RoomQuestion = {
  id: string;
  type: RoomQuestionType;
  prompt: string;
  options: string[];
  points: number;
  timeLimitSeconds: number;
};

export type RoomQuestionDefinition = RoomQuestion & {
  correctAnswer: string;
  explanation: string;
};

export type RoomCard = {
  id: string;
  title: string;
  description: string;
  effectType: RoomCardEffect;
  effectValue: number;
};

export type RoomContent = {
  questions: RoomQuestionDefinition[];
  cards: RoomCard[];
};

export type RoomPlayer = {
  id: string;
  nickname: string;
  role: PlayerRole;
  symbol: PlayerSymbol;
  connected: boolean;
  position: number;
  score: number;
  skipTurns: number;
  joinedAt: string;
};

export type RoomEvent = {
  type: "ROOM_CREATED" | "PLAYER_JOINED" | "PLAYER_CONNECTION_CHANGED" | "GAME_STARTED" | "DICE_ROLLED" | "QUESTION_PRESENTED" | "QUESTION_ANSWERED" | "CARD_DRAWN";
  at: string;
  actorId?: string;
  dice?: number;
  from?: number;
  to?: number;
  questionId?: string;
  cardId?: string;
  correct?: boolean;
  pointsAwarded?: number;
};

export type GameRoomState = {
  roomId: string;
  code: string;
  gameId: string;
  gameTitle: string;
  template: BoardGeometryId;
  skin: SkinId;
  status: RoomStatus;
  phase: GamePhase;
  version: number;
  round: number;
  turnIndex: number;
  currentPlayerId: string | null;
  lastRoll: number;
  questionCursor: number;
  cardCursor: number;
  activeQuestion: RoomQuestion | null;
  activeCard: RoomCard | null;
  lastAnswer: {
    playerId: string;
    correct: boolean;
    correctAnswer: string;
    explanation: string;
    pointsAwarded: number;
  } | null;
  players: RoomPlayer[];
  lastEvent: RoomEvent;
  updatedAt: string;
};

export type CreateRoomInput = Pick<
  GameRoomState,
  "roomId" | "code" | "gameId" | "gameTitle" | "template" | "skin"
> & {
  host: Pick<RoomPlayer, "id" | "nickname">;
  questions?: RoomQuestionDefinition[];
  cards?: RoomCard[];
  now?: string;
};

export type AddPlayerInput = Pick<RoomPlayer, "id" | "nickname"> & {
  role?: PlayerRole;
  now?: string;
};

export type ClientRoomMessage =
  | { type: "SYNC" }
  | { type: "START_GAME"; actionId: string; expectedVersion?: number }
  | { type: "ROLL_DICE"; actionId: string; expectedVersion?: number }
  | { type: "ANSWER_QUESTION"; actionId: string; answer: string; expectedVersion?: number };

export type ServerRoomMessage =
  | { type: "ROOM_STATE"; state: GameRoomState }
  | { type: "ROOM_ERROR"; code: string; message: string; state?: GameRoomState };

const playerSymbols: PlayerSymbol[] = ["book", "bulb", "compass", "leaf", "rocket"];
const tileTypes = [
  "START", "QUIZ", "BONUS", "QUIZ", "EVENT", "QUIZ", "REST", "QUIZ",
  "BONUS", "QUIZ", "EVENT", "QUIZ", "REST", "QUIZ", "BONUS", "QUIZ",
  "EVENT", "QUIZ", "REST", "QUIZ", "BONUS", "QUIZ", "EVENT", "QUIZ",
] as const;

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
    skipTurns: 0,
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
    phase: "WAITING_FOR_ROLL",
    version: 1,
    round: 1,
    turnIndex: 0,
    currentPlayerId: host.id,
    lastRoll: 1,
    questionCursor: 0,
    cardCursor: 0,
    activeQuestion: null,
    activeCard: null,
    lastAnswer: null,
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
    skipTurns: 0,
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
    { ...state, status: "PLAYING", phase: "WAITING_FOR_ROLL", turnIndex: 0, currentPlayerId: state.players[0]?.id ?? null },
    { type: "GAME_STARTED", at: now, actorId },
  );
}

export function rollDice(
  state: GameRoomState,
  actorId: string,
  dice: number,
  expectedVersion?: number,
  now = new Date().toISOString(),
  content: RoomContent = { questions: [], cards: [] },
): GameRoomState {
  assertVersion(state, expectedVersion);
  if (state.status !== "PLAYING") throw new GameRuleError("GAME_NOT_PLAYING", "게임이 아직 시작되지 않았습니다.");
  if (state.currentPlayerId !== actorId) throw new GameRuleError("NOT_YOUR_TURN", "현재 차례가 아닙니다.");
  if (state.phase !== "WAITING_FOR_ROLL") throw new GameRuleError("ANSWER_REQUIRED", "문제에 답한 뒤 다음 차례를 진행하세요.");
  if (!Number.isInteger(dice) || dice < 1 || dice > 6) throw new GameRuleError("INVALID_DICE", "주사위 값이 올바르지 않습니다.");

  const actor = state.players.find((player) => player.id === actorId);
  if (!actor) throw new GameRuleError("PLAYER_NOT_FOUND", "참가자를 찾을 수 없습니다.");

  const from = actor.position;
  const to = (from + dice) % 24;
  const movedPlayers = state.players.map((player) => player.id === actorId ? { ...player, position: to } : player);
  const tileType = tileTypes[to];

  if (tileType === "QUIZ" && content.questions.length > 0) {
    const definition = content.questions[state.questionCursor % content.questions.length];
    const activeQuestion: RoomQuestion = {
      id: definition.id,
      type: definition.type,
      prompt: definition.prompt,
      options: definition.options,
      points: definition.points,
      timeLimitSeconds: definition.timeLimitSeconds,
    };
    return nextVersion(
      {
        ...state,
        phase: "WAITING_FOR_ANSWER",
        lastRoll: dice,
        questionCursor: state.questionCursor + 1,
        activeQuestion,
        activeCard: null,
        lastAnswer: null,
        players: movedPlayers,
      },
      { type: "QUESTION_PRESENTED", at: now, actorId, dice, from, to, questionId: definition.id },
    );
  }

  if ((tileType === "BONUS" || tileType === "EVENT") && content.cards.length > 0) {
    const card = content.cards[state.cardCursor % content.cards.length];
    let players = movedPlayers;
    const keepTurn = card.effectType === "EXTRA_TURN";
    players = players.map((player) => {
      if (player.id !== actorId) return player;
      if (card.effectType === "MOVE_FORWARD") return { ...player, position: (player.position + card.effectValue) % 24 };
      if (card.effectType === "MOVE_BACK") return { ...player, position: (player.position - card.effectValue + 24) % 24 };
      if (card.effectType === "SCORE_BONUS") return { ...player, score: player.score + card.effectValue };
      if (card.effectType === "SKIP_TURN") return { ...player, skipTurns: player.skipTurns + 1 };
      return player;
    });
    const turn = keepTurn ? { turnIndex: state.turnIndex, currentPlayerId: actorId, round: state.round, players } : advanceTurn(state, players);
    return nextVersion(
      { ...state, ...turn, phase: "WAITING_FOR_ROLL", lastRoll: dice, cardCursor: state.cardCursor + 1, activeQuestion: null, activeCard: card, lastAnswer: null },
      { type: "CARD_DRAWN", at: now, actorId, dice, from, to, cardId: card.id },
    );
  }

  const turn = advanceTurn(state, movedPlayers);

  return nextVersion(
    {
      ...state,
      ...turn,
      phase: "WAITING_FOR_ROLL",
      lastRoll: dice,
      activeQuestion: null,
      activeCard: null,
      lastAnswer: null,
    },
    { type: "DICE_ROLLED", at: now, actorId, dice, from, to },
  );
}

function advanceTurn(state: GameRoomState, initialPlayers: RoomPlayer[]) {
  let players = initialPlayers;
  let nextTurnIndex = state.turnIndex;
  let round = state.round;
  for (let attempt = 0; attempt < state.players.length; attempt += 1) {
    nextTurnIndex = (nextTurnIndex + 1) % state.players.length;
    if (nextTurnIndex === 0) round += 1;
    const candidate = players[nextTurnIndex];
    if (!candidate || candidate.skipTurns === 0) break;
    players = players.map((player, index) => index === nextTurnIndex ? { ...player, skipTurns: player.skipTurns - 1 } : player);
  }
  return { players, turnIndex: nextTurnIndex, currentPlayerId: players[nextTurnIndex]?.id ?? null, round };
}

function normalizeAnswer(answer: string) {
  return answer.normalize("NFKC").trim().toLocaleLowerCase("ko-KR").replace(/\s+/g, " ");
}

export function answerQuestion(
  state: GameRoomState,
  actorId: string,
  answer: string,
  content: RoomContent,
  expectedVersion?: number,
  now = new Date().toISOString(),
) {
  assertVersion(state, expectedVersion);
  if (state.status !== "PLAYING" || state.phase !== "WAITING_FOR_ANSWER" || !state.activeQuestion) {
    throw new GameRuleError("NO_ACTIVE_QUESTION", "현재 답할 문제가 없습니다.");
  }
  if (state.currentPlayerId !== actorId) throw new GameRuleError("NOT_YOUR_TURN", "현재 차례가 아닙니다.");
  const definition = content.questions.find((question) => question.id === state.activeQuestion?.id);
  if (!definition) throw new GameRuleError("QUESTION_NOT_FOUND", "문제 정답 정보를 찾을 수 없습니다.");
  const submitted = normalizeAnswer(answer);
  const acceptedAnswers = definition.type === "SHORT_ANSWER"
    ? definition.correctAnswer.split(",").map(normalizeAnswer)
    : [normalizeAnswer(definition.correctAnswer)];
  const correct = submitted.length > 0 && acceptedAnswers.includes(submitted);
  const pointsAwarded = correct ? definition.points : 0;
  const scoredPlayers = state.players.map((player) => player.id === actorId ? { ...player, score: player.score + pointsAwarded } : player);
  const turn = advanceTurn(state, scoredPlayers);

  return nextVersion(
    {
      ...state,
      ...turn,
      phase: "WAITING_FOR_ROLL",
      activeQuestion: null,
      activeCard: null,
      lastAnswer: {
        playerId: actorId,
        correct,
        correctAnswer: definition.correctAnswer,
        explanation: definition.explanation,
        pointsAwarded,
      },
    },
    { type: "QUESTION_ANSWERED", at: now, actorId, questionId: definition.id, correct, pointsAwarded },
  );
}
