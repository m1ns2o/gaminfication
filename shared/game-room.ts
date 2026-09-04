import { advanceBoardPosition, boardGeometries, type BoardGeometryId, type SkinId } from "../app/lib/board.ts";

export const MAX_ROOM_PLAYERS = 40;

export type RoomStatus = "LOBBY" | "PLAYING" | "FINALIZED";
export type PlayerRole = "HOST" | "PLAYER";
export type PlayerSymbol = "book" | "bulb" | "compass" | "leaf" | "rocket";
export type GamePhase = "WAITING_FOR_ROLL" | "WAITING_FOR_ANSWER" | "FINISHED";
export type VictoryMode = "SCORE" | "ROUNDS" | "FINISH";
export type RoomQuestionType = "MULTIPLE_CHOICE" | "SHORT_ANSWER" | "OX";
export type RoomCardEffect = "MOVE_FORWARD" | "MOVE_BACK" | "SCORE_BONUS" | "EXTRA_TURN" | "SKIP_TURN";
export type RoomTileType = "START" | "QUIZ" | "BONUS" | "EVENT" | "REST";
export type AnswerMode = "TURN" | "ALL";
export type PlayMode = "INDIVIDUAL" | "TEAM";

export type RoomQuestion = {
  id: string;
  type: RoomQuestionType;
  prompt: string;
  options: string[];
  points: number;
  timeLimitSeconds: number;
  answerMode: AnswerMode;
  /** 문제 이미지 경로 (R2 제공) — 없으면 null */
  imageUrl?: string | null;
};

export type RoomQuestionDefinition = RoomQuestion & {
  correctAnswer: string;
  explanation: string;
  /** 특정 보드 칸에 고정된 문제일 때 칸 인덱스 (공용 풀이면 null) */
  tileIndex?: number | null;
};

export type RoomCard = {
  id: string;
  title: string;
  description: string;
  effectType: RoomCardEffect;
  effectValue: number;
  /** 특정 보드 칸에 고정된 카드일 때 칸 인덱스 (공용 풀이면 null) */
  tileIndex?: number | null;
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
  answersCount: number;
  correctAnswers: number;
  teamNumber: number | null;
  joinedAt: string;
};

export type RoomEvent = {
  type: "ROOM_CREATED" | "PLAYER_JOINED" | "PLAYER_CONNECTION_CHANGED" | "GAME_STARTED" | "DICE_ROLLED" | "QUESTION_PRESENTED" | "ANSWER_SUBMITTED" | "QUESTION_ANSWERED" | "CARD_DRAWN" | "GAME_FINISHED";
  at: string;
  actorId?: string;
  dice?: number;
  from?: number;
  to?: number;
  questionId?: string;
  cardId?: string;
  correct?: boolean;
  pointsAwarded?: number;
  timedOut?: boolean;
  finishReason?: "SCORE_TARGET" | "ROUND_LIMIT" | "FINISH_TILE" | "HOST_ENDED";
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
  gameRules: {
    victoryMode: VictoryMode;
    targetScore: number;
    maxRounds: number;
  };
  tileTypes: RoomTileType[];
  gameMode: {
    playMode: PlayMode;
    teamCount: number;
  };
  teamScores: Record<string, number>;
  version: number;
  round: number;
  turnIndex: number;
  currentPlayerId: string | null;
  lastRoll: number;
  questionCursor: number;
  cardCursor: number;
  activeQuestion: RoomQuestion | null;
  questionDeadlineAt: string | null;
  expectedResponderIds: string[];
  submittedPlayerIds: string[];
  activeCard: RoomCard | null;
  lastAnswer: {
    playerId: string;
    correct: boolean;
    correctAnswer: string;
    explanation: string;
    pointsAwarded: number;
    timedOut: boolean;
  } | null;
  lastGroupResult: {
    correctCount: number;
    totalCount: number;
    correctAnswer: string;
    explanation: string;
    timedOut: boolean;
  } | null;
  winnerIds: string[];
  winnerTeamNumbers: number[];
  finishedAt: string | null;
  players: RoomPlayer[];
  lastEvent: RoomEvent;
  updatedAt: string;
};

export type CreateRoomInput = Pick<
  GameRoomState,
  "roomId" | "code" | "gameId" | "gameTitle" | "template" | "skin"
> & {
  host: Pick<RoomPlayer, "id" | "nickname"> & { teamNumber?: number | null };
  questions?: RoomQuestionDefinition[];
  cards?: RoomCard[];
  gameRules?: GameRoomState["gameRules"];
  tileTypes?: RoomTileType[];
  gameMode?: GameRoomState["gameMode"];
  now?: string;
};

export type AddPlayerInput = Pick<RoomPlayer, "id" | "nickname"> & {
  role?: PlayerRole;
  teamNumber?: number | null;
  now?: string;
};

export type ClientRoomMessage =
  | { type: "SYNC" }
  | { type: "START_GAME"; actionId: string; expectedVersion?: number }
  | { type: "ROLL_DICE"; actionId: string; expectedVersion?: number }
  | { type: "ANSWER_QUESTION"; actionId: string; answer: string; expectedVersion?: number }
  | { type: "END_GAME"; actionId: string; expectedVersion?: number };

export type ServerRoomMessage =
  | { type: "ROOM_STATE"; state: GameRoomState }
  | { type: "ROOM_ERROR"; code: string; message: string; state?: GameRoomState };

const playerSymbols: PlayerSymbol[] = ["book", "bulb", "compass", "leaf", "rocket"];
const defaultRoomTileTypes: RoomTileType[] = [
  "START", "QUIZ", "BONUS", "QUIZ", "EVENT", "QUIZ", "REST", "QUIZ",
  "BONUS", "QUIZ", "EVENT", "QUIZ", "REST", "QUIZ", "BONUS", "QUIZ",
  "EVENT", "QUIZ", "REST", "QUIZ", "BONUS", "QUIZ", "EVENT", "QUIZ",
] as const;

function initialTeamScores(teamCount: number) {
  return Object.fromEntries(Array.from({ length: teamCount }, (_, index) => [String(index + 1), 0]));
}

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

export function normalizeRoomState(state: GameRoomState): GameRoomState {
  return {
    ...state,
    phase: state.status === "FINALIZED" ? "FINISHED" : (state.phase ?? "WAITING_FOR_ROLL"),
    gameRules: state.gameRules ?? {
      victoryMode: boardGeometries[state.template].wraps ? "SCORE" : "FINISH",
      targetScore: 100,
      maxRounds: 10,
    },
    tileTypes: state.tileTypes?.length === 24 ? state.tileTypes : [...defaultRoomTileTypes],
    gameMode: state.gameMode ?? { playMode: "INDIVIDUAL", teamCount: 2 },
    teamScores: state.teamScores ?? initialTeamScores(state.gameMode?.teamCount ?? 2),
    questionDeadlineAt: state.questionDeadlineAt ?? null,
    activeQuestion: state.activeQuestion ? { ...state.activeQuestion, answerMode: state.activeQuestion.answerMode ?? "TURN" } : null,
    expectedResponderIds: state.expectedResponderIds ?? [],
    submittedPlayerIds: state.submittedPlayerIds ?? [],
    winnerIds: state.winnerIds ?? [],
    winnerTeamNumbers: state.winnerTeamNumbers ?? [],
    finishedAt: state.finishedAt ?? null,
    lastAnswer: state.lastAnswer ? { ...state.lastAnswer, timedOut: state.lastAnswer.timedOut ?? false } : null,
    lastGroupResult: state.lastGroupResult ?? null,
    players: state.players.map((player) => ({
      ...player,
      skipTurns: player.skipTurns ?? 0,
      answersCount: player.answersCount ?? 0,
      correctAnswers: player.correctAnswers ?? 0,
      teamNumber: player.teamNumber ?? null,
    })),
  };
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
    answersCount: 0,
    correctAnswers: 0,
    teamNumber: input.gameMode?.playMode === "TEAM" ? input.host.teamNumber ?? 1 : null,
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
    gameRules: input.gameRules ?? {
      victoryMode: boardGeometries[input.template].wraps ? "SCORE" : "FINISH",
      targetScore: 100,
      maxRounds: 10,
    },
    tileTypes: input.tileTypes?.length === 24 ? input.tileTypes : [...defaultRoomTileTypes],
    gameMode: input.gameMode ?? { playMode: "INDIVIDUAL", teamCount: 2 },
    teamScores: initialTeamScores(input.gameMode?.teamCount ?? 2),
    version: 1,
    round: 1,
    turnIndex: 0,
    currentPlayerId: host.id,
    lastRoll: 1,
    questionCursor: 0,
    cardCursor: 0,
    activeQuestion: null,
    questionDeadlineAt: null,
    expectedResponderIds: [],
    submittedPlayerIds: [],
    activeCard: null,
    lastAnswer: null,
    lastGroupResult: null,
    winnerIds: [],
    winnerTeamNumbers: [],
    finishedAt: null,
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
  const teamNumber = state.gameMode.playMode === "TEAM" ? input.teamNumber : null;
  if (state.gameMode.playMode === "TEAM" && (!teamNumber || teamNumber < 1 || teamNumber > state.gameMode.teamCount)) {
    throw new GameRuleError("TEAM_INVALID", `1–${state.gameMode.teamCount}팀 중 하나를 선택하세요.`);
  }
  const player: RoomPlayer = {
    id: input.id,
    nickname: input.nickname,
    role: input.role ?? "PLAYER",
    symbol: playerSymbols[state.players.length % playerSymbols.length],
    connected: false,
    position: 0,
    score: 0,
    skipTurns: 0,
    answersCount: 0,
    correctAnswers: 0,
    teamNumber: teamNumber ?? null,
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

function leadingTeams(state: GameRoomState) {
  const highestScore = Math.max(...Object.values(state.teamScores));
  return Object.entries(state.teamScores).filter(([, score]) => score === highestScore).map(([team]) => Number(team));
}

function rankedWinnerIds(state: GameRoomState) {
  if (state.gameMode.playMode === "TEAM") {
    const teams = leadingTeams(state);
    return state.players.filter((player) => player.teamNumber && teams.includes(player.teamNumber)).map((player) => player.id);
  }
  const highestScore = Math.max(...state.players.map((player) => player.score));
  return state.players.filter((player) => player.score === highestScore).map((player) => player.id);
}

function finishReason(state: GameRoomState) {
  if (state.gameRules.victoryMode === "FINISH" && state.players.some((player) => player.position >= 23)) return "FINISH_TILE" as const;
  if (state.gameRules.victoryMode === "SCORE" && (
    state.gameMode.playMode === "TEAM"
      ? Object.values(state.teamScores).some((score) => score >= state.gameRules.targetScore)
      : state.players.some((player) => player.score >= state.gameRules.targetScore)
  )) return "SCORE_TARGET" as const;
  if (state.gameRules.victoryMode === "ROUNDS" && state.round > state.gameRules.maxRounds) return "ROUND_LIMIT" as const;
  return null;
}

function finishGameState(
  state: GameRoomState,
  reason: NonNullable<RoomEvent["finishReason"]>,
  now: string,
  event: Omit<RoomEvent, "type" | "at" | "finishReason"> = {},
) {
  const initialWinnerIds = reason === "FINISH_TILE"
    ? state.players.filter((player) => player.position >= 23).map((player) => player.id)
    : rankedWinnerIds(state);
  const winnerTeamNumbers = state.gameMode.playMode === "TEAM"
    ? [...new Set(initialWinnerIds.map((id) => state.players.find((player) => player.id === id)?.teamNumber).filter((team): team is number => team !== null && team !== undefined))]
    : [];
  const winnerIds = state.gameMode.playMode === "TEAM"
    ? state.players.filter((player) => player.teamNumber && winnerTeamNumbers.includes(player.teamNumber)).map((player) => player.id)
    : initialWinnerIds;
  return nextVersion(
    {
      ...state,
      status: "FINALIZED",
      phase: "FINISHED",
      currentPlayerId: null,
      activeQuestion: null,
      questionDeadlineAt: null,
      expectedResponderIds: [],
      submittedPlayerIds: [],
      activeCard: null,
      winnerIds,
      winnerTeamNumbers,
      finishedAt: now,
      round: Math.min(state.round, state.gameRules.maxRounds),
    },
    { ...event, type: "GAME_FINISHED", at: now, finishReason: reason },
  );
}

function completeTransition(state: GameRoomState, event: RoomEvent) {
  const reason = finishReason(state);
  if (reason) {
    return finishGameState(state, reason, event.at, {
      actorId: event.actorId,
      dice: event.dice,
      from: event.from,
      to: event.to,
      questionId: event.questionId,
      cardId: event.cardId,
      correct: event.correct,
      pointsAwarded: event.pointsAwarded,
      timedOut: event.timedOut,
    });
  }
  return nextVersion(state, event);
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
  const to = advanceBoardPosition(state.template, from, dice);
  const movedPlayers = state.players.map((player) => player.id === actorId ? { ...player, position: to } : player);
  const tileType = state.tileTypes[to];

  const movedState = { ...state, lastRoll: dice, players: movedPlayers, activeQuestion: null, questionDeadlineAt: null, expectedResponderIds: [], submittedPlayerIds: [], activeCard: null, lastAnswer: null, lastGroupResult: null };
  const movementFinishReason = finishReason(movedState);
  if (movementFinishReason) {
    return finishGameState(movedState, movementFinishReason, now, { actorId, dice, from, to });
  }

  const contentSelection = (() => {
    if (tileType === "QUIZ") {
      // 칸에 고정된 문제를 우선하고, 없으면 공용 풀(미고정)에서 순환 배치한다.
      const boundQuestion = content.questions.find((question) => question.tileIndex === to);
      if (boundQuestion) return { kind: "question" as const, definition: boundQuestion, bound: true };
      const poolQuestions = content.questions.filter((question) => question.tileIndex == null);
      if (poolQuestions.length === 0) return null;
      return { kind: "question" as const, definition: poolQuestions[state.questionCursor % poolQuestions.length], bound: false };
    }
    if (tileType === "BONUS" || tileType === "EVENT") {
      // 칸에 고정된 카드를 우선하고, 없으면 공용 풀(미고정)에서 순환 배치한다.
      const boundCard = content.cards.find((card) => card.tileIndex === to);
      if (boundCard) return { kind: "card" as const, definition: boundCard, bound: true };
      const poolCards = content.cards.filter((card) => card.tileIndex == null);
      if (poolCards.length === 0) return null;
      return { kind: "card" as const, definition: poolCards[state.cardCursor % poolCards.length], bound: false };
    }
    return null;
  })();

  if (tileType === "QUIZ" && contentSelection?.kind === "question") {
    const question = contentSelection.definition;
    const boundQuestion = contentSelection.bound;
    const activeQuestion: RoomQuestion = {
      id: question.id,
      type: question.type,
      prompt: question.prompt,
      options: question.options,
      points: question.points,
      timeLimitSeconds: question.timeLimitSeconds,
      answerMode: question.answerMode,
      imageUrl: question.imageUrl ?? null,
    };
    const connectedPlayerIds = state.players.filter((player) => player.connected).map((player) => player.id);
    const expectedResponderIds = question.answerMode === "ALL"
      ? connectedPlayerIds.length > 0 ? connectedPlayerIds : state.players.map((player) => player.id)
      : [actorId];
    return nextVersion(
      {
        ...state,
        phase: "WAITING_FOR_ANSWER",
        lastRoll: dice,
        questionCursor: boundQuestion ? state.questionCursor : state.questionCursor + 1,
        activeQuestion,
        questionDeadlineAt: new Date(new Date(now).getTime() + question.timeLimitSeconds * 1000).toISOString(),
        expectedResponderIds,
        submittedPlayerIds: [],
        activeCard: null,
        lastAnswer: null,
        lastGroupResult: null,
        players: movedPlayers,
      },
      { type: "QUESTION_PRESENTED", at: now, actorId, dice, from, to, questionId: question.id },
    );
  }

  if (contentSelection?.kind === "card" && (tileType === "BONUS" || tileType === "EVENT")) {
    const card = contentSelection.definition;
    const boundCard = contentSelection.bound;
    let players = movedPlayers;
    let teamScores = state.teamScores;
    const keepTurn = card.effectType === "EXTRA_TURN";
    players = players.map((player) => {
      if (player.id !== actorId) return player;
      if (card.effectType === "MOVE_FORWARD") return { ...player, position: advanceBoardPosition(state.template, player.position, card.effectValue) };
      if (card.effectType === "MOVE_BACK") return { ...player, position: advanceBoardPosition(state.template, player.position, -card.effectValue) };
      if (card.effectType === "SCORE_BONUS") return { ...player, score: player.score + card.effectValue };
      if (card.effectType === "SKIP_TURN") return { ...player, skipTurns: player.skipTurns + 1 };
      return player;
    });
    if (card.effectType === "SCORE_BONUS" && state.gameMode.playMode === "TEAM" && actor.teamNumber) {
      teamScores = { ...teamScores, [String(actor.teamNumber)]: (teamScores[String(actor.teamNumber)] ?? 0) + card.effectValue };
    }
    const turn = keepTurn ? { turnIndex: state.turnIndex, currentPlayerId: actorId, round: state.round, players } : advanceTurn(state, players);
    return completeTransition(
      { ...state, ...turn, teamScores, phase: "WAITING_FOR_ROLL", lastRoll: dice, cardCursor: boundCard ? state.cardCursor : state.cardCursor + 1, activeQuestion: null, questionDeadlineAt: null, expectedResponderIds: [], submittedPlayerIds: [], activeCard: card, lastAnswer: null, lastGroupResult: null },
      { type: "CARD_DRAWN", at: now, actorId, dice, from, to, cardId: card.id },
    );
  }

  const turn = advanceTurn(state, movedPlayers);

  return completeTransition(
    {
      ...state,
      ...turn,
      phase: "WAITING_FOR_ROLL",
      lastRoll: dice,
      activeQuestion: null,
      questionDeadlineAt: null,
      expectedResponderIds: [],
      submittedPlayerIds: [],
      activeCard: null,
      lastAnswer: null,
      lastGroupResult: null,
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

export function isCorrectAnswer(definition: RoomQuestionDefinition, answer: string) {
  const submitted = normalizeAnswer(answer);
  const acceptedAnswers = definition.type === "SHORT_ANSWER"
    ? definition.correctAnswer.split(",").map(normalizeAnswer)
    : [normalizeAnswer(definition.correctAnswer)];
  return submitted.length > 0 && acceptedAnswers.includes(submitted);
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
  if (answer.length > 500) throw new GameRuleError("ANSWER_TOO_LONG", "답안은 500자 이내로 입력하세요.");
  const definition = content.questions.find((question) => question.id === state.activeQuestion?.id);
  if (!definition) throw new GameRuleError("QUESTION_NOT_FOUND", "문제 정답 정보를 찾을 수 없습니다.");
  if (definition.answerMode === "ALL") throw new GameRuleError("ALL_ANSWER_REQUIRED", "전원 동시 문제는 모든 참가자의 답을 수집합니다.");
  if (state.questionDeadlineAt && new Date(now).getTime() >= new Date(state.questionDeadlineAt).getTime()) {
    return resolveQuestion(state, definition, actorId, false, true, now);
  }
  const correct = isCorrectAnswer(definition, answer);
  return resolveQuestion(state, definition, actorId, correct, false, now);
}

function resolveQuestion(
  state: GameRoomState,
  definition: RoomQuestionDefinition,
  actorId: string,
  correct: boolean,
  timedOut: boolean,
  now: string,
) {
  const pointsAwarded = correct ? definition.points : 0;
  const scoredPlayers = state.players.map((player) => player.id === actorId ? {
    ...player,
    score: player.score + pointsAwarded,
    answersCount: player.answersCount + 1,
    correctAnswers: player.correctAnswers + (correct ? 1 : 0),
  } : player);
  const actor = state.players.find((player) => player.id === actorId);
  const teamScores = correct && state.gameMode.playMode === "TEAM" && actor?.teamNumber
    ? { ...state.teamScores, [String(actor.teamNumber)]: (state.teamScores[String(actor.teamNumber)] ?? 0) + pointsAwarded }
    : state.teamScores;
  const turn = advanceTurn(state, scoredPlayers);

  return completeTransition(
    {
      ...state,
      ...turn,
      teamScores,
      phase: "WAITING_FOR_ROLL",
      activeQuestion: null,
      questionDeadlineAt: null,
      expectedResponderIds: [],
      submittedPlayerIds: [],
      activeCard: null,
      lastAnswer: {
        playerId: actorId,
        correct,
        correctAnswer: definition.correctAnswer,
        explanation: definition.explanation,
        pointsAwarded,
        timedOut,
      },
      lastGroupResult: null,
    },
    { type: "QUESTION_ANSWERED", at: now, actorId, questionId: definition.id, correct, pointsAwarded, timedOut },
  );
}

export function submitAllAnswer(
  state: GameRoomState,
  actorId: string,
  expectedVersion?: number,
  now = new Date().toISOString(),
) {
  assertVersion(state, expectedVersion);
  if (state.status !== "PLAYING" || state.phase !== "WAITING_FOR_ANSWER" || state.activeQuestion?.answerMode !== "ALL") {
    throw new GameRuleError("NO_ACTIVE_ALL_QUESTION", "현재 전원 동시 문제가 없습니다.");
  }
  if (!state.expectedResponderIds.includes(actorId)) throw new GameRuleError("NOT_A_RESPONDER", "이 문제의 응답 대상이 아닙니다.");
  if (state.submittedPlayerIds.includes(actorId)) throw new GameRuleError("ANSWER_ALREADY_SUBMITTED", "이미 답안을 제출했습니다.");
  return nextVersion(
    { ...state, submittedPlayerIds: [...state.submittedPlayerIds, actorId] },
    { type: "ANSWER_SUBMITTED", at: now, actorId, questionId: state.activeQuestion.id },
  );
}

export function resolveAllAnswers(
  state: GameRoomState,
  content: RoomContent,
  answers: Record<string, string>,
  timedOut: boolean,
  now = new Date().toISOString(),
) {
  if (state.status !== "PLAYING" || state.phase !== "WAITING_FOR_ANSWER" || state.activeQuestion?.answerMode !== "ALL" || !state.currentPlayerId) {
    throw new GameRuleError("NO_ACTIVE_ALL_QUESTION", "현재 전원 동시 문제가 없습니다.");
  }
  const definition = content.questions.find((question) => question.id === state.activeQuestion?.id);
  if (!definition) throw new GameRuleError("QUESTION_NOT_FOUND", "문제 정답 정보를 찾을 수 없습니다.");
  const expected = new Set(state.expectedResponderIds);
  let correctCount = 0;
  let teamScores = state.teamScores;
  const scoredPlayers = state.players.map((player) => {
    if (!expected.has(player.id)) return player;
    const correct = isCorrectAnswer(definition, answers[player.id] ?? "");
    if (correct) correctCount += 1;
    const pointsAwarded = correct ? definition.points : 0;
    if (correct && state.gameMode.playMode === "TEAM" && player.teamNumber) {
      teamScores = { ...teamScores, [String(player.teamNumber)]: (teamScores[String(player.teamNumber)] ?? 0) + pointsAwarded };
    }
    return {
      ...player,
      score: player.score + pointsAwarded,
      answersCount: player.answersCount + 1,
      correctAnswers: player.correctAnswers + (correct ? 1 : 0),
    };
  });
  const turn = advanceTurn(state, scoredPlayers);
  return completeTransition(
    {
      ...state,
      ...turn,
      teamScores,
      phase: "WAITING_FOR_ROLL",
      activeQuestion: null,
      questionDeadlineAt: null,
      expectedResponderIds: [],
      submittedPlayerIds: [],
      activeCard: null,
      lastAnswer: null,
      lastGroupResult: {
        correctCount,
        totalCount: state.expectedResponderIds.length,
        correctAnswer: definition.correctAnswer,
        explanation: definition.explanation,
        timedOut,
      },
    },
    { type: "QUESTION_ANSWERED", at: now, actorId: state.currentPlayerId, questionId: definition.id, correct: correctCount === state.expectedResponderIds.length, pointsAwarded: correctCount * definition.points, timedOut },
  );
}

export function timeoutQuestion(
  state: GameRoomState,
  content: RoomContent,
  now = new Date().toISOString(),
) {
  if (state.status !== "PLAYING" || state.phase !== "WAITING_FOR_ANSWER" || !state.activeQuestion || !state.currentPlayerId) return state;
  const definition = content.questions.find((question) => question.id === state.activeQuestion?.id);
  if (!definition) throw new GameRuleError("QUESTION_NOT_FOUND", "문제 정답 정보를 찾을 수 없습니다.");
  if (state.questionDeadlineAt && new Date(now).getTime() < new Date(state.questionDeadlineAt).getTime()) return state;
  if (definition.answerMode === "ALL") return resolveAllAnswers(state, content, {}, true, now);
  return resolveQuestion(state, definition, state.currentPlayerId, false, true, now);
}

export function endGame(
  state: GameRoomState,
  actorId: string,
  expectedVersion?: number,
  now = new Date().toISOString(),
) {
  assertVersion(state, expectedVersion);
  const actor = state.players.find((player) => player.id === actorId);
  if (actor?.role !== "HOST") throw new GameRuleError("HOST_ONLY", "진행자만 게임을 종료할 수 있습니다.");
  if (state.status !== "PLAYING") throw new GameRuleError("GAME_NOT_PLAYING", "진행 중인 게임만 종료할 수 있습니다.");
  return finishGameState(state, "HOST_ENDED", now, { actorId });
}
