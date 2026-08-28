import assert from "node:assert/strict";
import test from "node:test";
import {
  GameRuleError,
  addPlayer,
  answerQuestion,
  createRoomState,
  rollDice,
  setPlayerConnected,
  startGame,
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
    questions: [{ id: "q1", type: "SHORT_ANSWER", prompt: "왕실 도서관은?", options: [], correctAnswer: "규장각, 奎章閣", explanation: "정조가 설치했습니다.", points: 20, timeLimitSeconds: 30 }],
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
