import assert from "node:assert/strict";
import test from "node:test";
import {
  GameRuleError,
  addPlayer,
  answerQuestion,
  createRoomState,
  endGame,
  rollDice,
  resolveAllAnswers,
  setPlayerConnected,
  startGame,
  submitAllAnswer,
  timeoutQuestion,
} from "../shared/game-room.ts";

const firstTime = "2026-08-29T00:00:00.000Z";

function createFixture() {
  return createRoomState({
    roomId: "room-1",
    code: "482731",
    gameId: "game-1",
    gameTitle: "실시간 역사 게임",
    template: "LOOP_24",
    skin: "CAMPUS",
    host: { id: "host-1", nickname: "진행자" },
    now: firstTime,
  });
}

test("creates a lobby and advances authoritative turns", () => {
  let state = createFixture();
  state = addPlayer(state, { id: "player-1", nickname: "별빛나침반", now: firstTime });
  state = setPlayerConnected(state, "host-1", true, firstTime);
  state = setPlayerConnected(state, "player-1", true, firstTime);
  state = startGame(state, "host-1", state.version, firstTime);

  state = rollDice(state, "host-1", 6, state.version, firstTime);
  assert.equal(state.players[0].position, 6);
  assert.equal(state.currentPlayerId, "player-1");
  assert.equal(state.round, 1);

  state = rollDice(state, "player-1", 4, state.version, firstTime);
  assert.equal(state.players[1].position, 4);
  assert.equal(state.currentPlayerId, "host-1");
  assert.equal(state.round, 2);
});

test("rejects non-host starts, stale commands, and out-of-turn rolls", () => {
  let state = addPlayer(createFixture(), { id: "player-1", nickname: "별빛나침반", now: firstTime });

  assert.throws(
    () => startGame(state, "player-1", state.version, firstTime),
    (error) => error instanceof GameRuleError && error.code === "HOST_ONLY",
  );

  state = startGame(state, "host-1", state.version, firstTime);
  assert.throws(
    () => rollDice(state, "player-1", 3, state.version, firstTime),
    (error) => error instanceof GameRuleError && error.code === "NOT_YOUR_TURN",
  );
  assert.throws(
    () => rollDice(state, "host-1", 3, state.version - 1, firstTime),
    (error) => error instanceof GameRuleError && error.code === "STALE_STATE",
  );
});

test("presents a safe quiz, validates the answer, and awards points", () => {
  let state = addPlayer(createFixture(), { id: "player-1", nickname: "별빛나침반", now: firstTime });
  state = startGame(state, "host-1", state.version, firstTime);
  const content = {
    questions: [{ id: "q1", type: "SHORT_ANSWER", prompt: "왕실 도서관은?", options: [], correctAnswer: "규장각, 奎章閣", explanation: "정조가 설치했습니다.", points: 20, timeLimitSeconds: 30, answerMode: "TURN" }],
    cards: [],
  };

  state = rollDice(state, "host-1", 1, state.version, firstTime, content);
  assert.equal(state.phase, "WAITING_FOR_ANSWER");
  assert.equal(state.currentPlayerId, "host-1");
  assert.equal("correctAnswer" in state.activeQuestion, false);

  state = answerQuestion(state, "host-1", " 규장각 ", content, state.version, firstTime);
  assert.equal(state.lastAnswer.correct, true);
  assert.equal(state.players[0].score, 20);
  assert.equal(state.currentPlayerId, "player-1");
});

test("applies a server-owned educational card effect", () => {
  let state = addPlayer(createFixture(), { id: "player-1", nickname: "별빛나침반", now: firstTime });
  state = startGame(state, "host-1", state.version, firstTime);
  const content = {
    questions: [],
    cards: [{ id: "c1", title: "탐구 점수", description: "좋은 질문 보너스", effectType: "SCORE_BONUS", effectValue: 5 }],
  };

  state = rollDice(state, "host-1", 2, state.version, firstTime, content);
  assert.equal(state.activeCard.title, "탐구 점수");
  assert.equal(state.players[0].score, 5);
  assert.equal(state.currentPlayerId, "player-1");
});

test("finishes a race at tile 24 without wrapping to the start", () => {
  let state = createRoomState({
    roomId: "race-room", code: "111111", gameId: "race-game", gameTitle: "완주 게임",
    template: "RACE_24", skin: "CAMPUS", host: { id: "host-1", nickname: "진행자" }, now: firstTime,
  });
  state = startGame(state, "host-1", state.version, firstTime);
  state = { ...state, players: state.players.map((player) => ({ ...player, position: 20 })) };
  state = rollDice(state, "host-1", 6, state.version, firstTime);
  assert.equal(state.players[0].position, 23);
  assert.equal(state.status, "FINALIZED");
  assert.deepEqual(state.winnerIds, ["host-1"]);
});

test("supports score, round, timeout, and host-ended completion", () => {
  const content = {
    questions: [{ id: "q1", type: "OX", prompt: "정답은 O", options: ["O", "X"], correctAnswer: "O", explanation: "", points: 20, timeLimitSeconds: 10, answerMode: "TURN" }],
    cards: [],
  };
  let scoreState = createFixture();
  scoreState = { ...scoreState, gameRules: { victoryMode: "SCORE", targetScore: 20, maxRounds: 10 } };
  scoreState = startGame(scoreState, "host-1", scoreState.version, firstTime);
  scoreState = rollDice(scoreState, "host-1", 1, scoreState.version, firstTime, content);
  scoreState = answerQuestion(scoreState, "host-1", "O", content, scoreState.version, "2026-08-29T00:00:05.000Z");
  assert.equal(scoreState.status, "FINALIZED");

  let roundState = createRoomState({ roomId: "round-room", code: "222222", gameId: "g", gameTitle: "라운드", template: "LOOP_24", skin: "CAMPUS", host: { id: "host-1", nickname: "진행자" }, gameRules: { victoryMode: "ROUNDS", targetScore: 100, maxRounds: 1 }, now: firstTime });
  roundState = startGame(roundState, "host-1", roundState.version, firstTime);
  roundState = rollDice(roundState, "host-1", 6, roundState.version, firstTime);
  assert.equal(roundState.status, "FINALIZED");

  let timeoutState = startGame(createFixture(), "host-1", createFixture().version, firstTime);
  timeoutState = rollDice(timeoutState, "host-1", 1, timeoutState.version, firstTime, content);
  timeoutState = timeoutQuestion(timeoutState, content, "2026-08-29T00:00:11.000Z");
  assert.equal(timeoutState.lastAnswer.timedOut, true);
  assert.equal(timeoutState.players[0].answersCount, 1);

  let endedState = startGame(createFixture(), "host-1", createFixture().version, firstTime);
  endedState = endGame(endedState, "host-1", endedState.version, firstTime);
  assert.equal(endedState.lastEvent.finishReason, "HOST_ENDED");
});

test("uses the teacher-authored tile layout in the authoritative engine", () => {
  const customTiles = ["START", ...Array.from({ length: 23 }, () => "REST")];
  let state = createRoomState({
    roomId: "custom-map", code: "333333", gameId: "g", gameTitle: "직접 만든 맵",
    template: "LOOP_24", skin: "CAMPUS", host: { id: "host-1", nickname: "진행자" }, tileTypes: customTiles, now: firstTime,
  });
  state = addPlayer(state, { id: "player-1", nickname: "참가자", now: firstTime });
  state = startGame(state, "host-1", state.version, firstTime);
  state = rollDice(state, "host-1", 1, state.version, firstTime, {
    questions: [{ id: "q1", type: "OX", prompt: "출제되지 않아야 함", options: ["O", "X"], correctAnswer: "O", explanation: "", points: 10, timeLimitSeconds: 10, answerMode: "TURN" }],
    cards: [],
  });
  assert.equal(state.activeQuestion, null);
  assert.equal(state.currentPlayerId, "player-1");
});

test("collects simultaneous answers privately and awards team scores", () => {
  let state = createRoomState({
    roomId: "team-room", code: "444444", gameId: "g", gameTitle: "팀 퀴즈",
    template: "LOOP_24", skin: "CAMPUS", host: { id: "host-1", nickname: "진행자", teamNumber: 1 },
    gameMode: { playMode: "TEAM", teamCount: 2 }, now: firstTime,
  });
  state = addPlayer(state, { id: "player-1", nickname: "참가자", teamNumber: 2, now: firstTime });
  state = setPlayerConnected(state, "host-1", true, firstTime);
  state = setPlayerConnected(state, "player-1", true, firstTime);
  state = startGame(state, "host-1", state.version, firstTime);
  const content = {
    questions: [{ id: "q-all", type: "OX", prompt: "정답은 O", options: ["O", "X"], correctAnswer: "O", explanation: "", points: 15, timeLimitSeconds: 10, answerMode: "ALL" }],
    cards: [],
  };

  state = rollDice(state, "host-1", 1, state.version, firstTime, content);
  assert.deepEqual(state.expectedResponderIds, ["host-1", "player-1"]);
  state = submitAllAnswer(state, "host-1", state.version, "2026-08-29T00:00:02.000Z");
  assert.deepEqual(state.submittedPlayerIds, ["host-1"]);
  assert.equal("pendingAnswers" in state, false, "Public state must never contain the private answer buffer");
  state = submitAllAnswer(state, "player-1", state.version, "2026-08-29T00:00:03.000Z");
  state = resolveAllAnswers(state, content, { "host-1": "O", "player-1": "X" }, false, "2026-08-29T00:00:03.000Z");
  assert.equal(state.lastGroupResult.correctCount, 1);
  assert.equal(state.teamScores["1"], 15);
  assert.equal(state.teamScores["2"], 0);
  assert.equal(state.players[0].answersCount, 1);
  assert.equal(state.currentPlayerId, "player-1");
});
