import assert from "node:assert/strict";
import test from "node:test";
import {
  GameRuleError,
  addPlayer,
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
