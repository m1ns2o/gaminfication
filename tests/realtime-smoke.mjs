import assert from "node:assert/strict";

const baseUrl = process.env.BOARDRUN_BASE_URL ?? "http://localhost:3000";
const teacherSessionToken = (process.env.BOARDRUN_TEST_SESSION_TOKEN ?? "").trim();

if (!teacherSessionToken) {
  throw new Error("BOARDRUN_TEST_SESSION_TOKEN is required. For local testing, run `npm run test:realtime:local`.");
}

async function requestJson(path, init) {
  const response = await fetch(new URL(path, baseUrl), init);
  const payload = await response.json();
  if (!response.ok) throw new Error(`${response.status} ${JSON.stringify(payload)}`);
  return payload;
}

function withTeacherAuth(init = {}) {
  const headers = new Headers(init.headers);
  headers.set("cookie", `boardrun_teacher_session=${encodeURIComponent(teacherSessionToken)}`);
  return { ...init, headers };
}

function teacherRequest(path, init = {}) {
  return requestJson(path, withTeacherAuth(init));
}

function socketUrl(path) {
  const url = new URL(path, baseUrl);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url;
}

function connect(path) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(socketUrl(path));
    const states = [];
    const waiters = [];

    socket.addEventListener("message", (event) => {
      if (event.data === "pong") return;
      const message = JSON.parse(String(event.data));
      if (message.type === "ROOM_ERROR") {
        for (const waiter of waiters.splice(0)) waiter.reject(new Error(`${message.code}: ${message.message}`));
        return;
      }
      if (message.type !== "ROOM_STATE") return;
      states.push(message.state);
      for (let index = waiters.length - 1; index >= 0; index -= 1) {
        if (waiters[index].predicate(message.state)) {
          const [waiter] = waiters.splice(index, 1);
          waiter.resolve(message.state);
        }
      }
    });

    socket.addEventListener("open", () => resolve({
      socket,
      latest: () => states.at(-1),
      waitFor(predicate, timeoutMs = 5_000) {
        const existing = states.findLast(predicate);
        if (existing) return Promise.resolve(existing);
        return new Promise((waiterResolve, waiterReject) => {
          const waiter = { predicate, resolve: waiterResolve, reject: waiterReject };
          waiters.push(waiter);
          setTimeout(() => {
            const index = waiters.indexOf(waiter);
            if (index >= 0) waiters.splice(index, 1);
            waiterReject(new Error("Timed out waiting for room state"));
          }, timeoutMs);
        });
      },
    }));
    socket.addEventListener("error", () => reject(new Error("WebSocket connection failed")));
  });
}

const createdGame = await teacherRequest("/api/v1/me/games", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ title: `실시간 퀴즈 검증 ${Date.now()}`, template: "LOOP_24", skin: "CAMPUS" }),
});
await teacherRequest(`/api/v1/games/${createdGame.game.id}`, {
  method: "PUT",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ playMode: "TEAM", teamCount: 2 }),
});
await teacherRequest(`/api/v1/games/${createdGame.game.id}/questions`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ type: "SHORT_ANSWER", prompt: "정조가 설치한 왕실 도서관은?", correctAnswer: "규장각", explanation: "정조가 설치했습니다.", points: 20, timeLimitSeconds: 5, answerMode: "ALL" }),
});

const hostSession = await teacherRequest("/api/v1/rooms", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ gameId: createdGame.game.id }),
});
const roomLookup = await requestJson(`/api/v1/rooms/join?code=${hostSession.room.code}`);
assert.equal(roomLookup.room.playMode, "TEAM");
assert.equal(roomLookup.room.teamCount, 2);
const playerSession = await requestJson("/api/v1/rooms/join", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ code: hostSession.room.code, nickname: "통합테스트", teamNumber: 2 }),
});

const host = await connect(hostSession.realtime.websocketPath);
const player = await connect(playerSession.realtime.websocketPath);

try {
  const lobby = await host.waitFor((state) => state.players.length === 2 && state.players.every((entry) => entry.connected));
  host.socket.send(JSON.stringify({ type: "START_GAME", actionId: crypto.randomUUID(), expectedVersion: lobby.version }));

  const started = await host.waitFor((state) => state.status === "PLAYING");
  assert.equal(started.currentPlayerId, hostSession.participant.id);
  let state = started;
  let groupQuizTimedOut = false;
  for (let attempt = 0; attempt < 24 && !groupQuizTimedOut; attempt += 1) {
    const actor = state.currentPlayerId === hostSession.participant.id ? host : player;
    actor.socket.send(JSON.stringify({ type: "ROLL_DICE", actionId: crypto.randomUUID(), expectedVersion: state.version }));
    state = await host.waitFor((next) => next.version > state.version);
    const mirrored = await player.waitFor((next) => next.version === state.version);
    assert.equal(mirrored.lastRoll, state.lastRoll);
    if (state.phase !== "WAITING_FOR_ANSWER") continue;
    assert.equal("correctAnswer" in state.activeQuestion, false, "Active state must not leak the answer");
    assert.equal(state.activeQuestion.answerMode, "ALL");
    assert.equal(state.expectedResponderIds.length, 2);
    host.socket.send(JSON.stringify({ type: "ANSWER_QUESTION", actionId: crypto.randomUUID(), answer: "규장각", expectedVersion: state.version }));
    state = await host.waitFor((next) => next.version > state.version && next.lastEvent.type === "ANSWER_SUBMITTED");
    assert.deepEqual(state.submittedPlayerIds, [hostSession.participant.id]);
    assert.equal("submittedAnswer" in state, false, "Submitted answers must remain private in Durable Object storage");
    state = await host.waitFor((next) => next.version > state.version && next.lastEvent.type === "QUESTION_ANSWERED", 8_000);
    assert.equal(state.lastGroupResult.correctCount, 1);
    assert.equal(state.lastGroupResult.timedOut, true);
    assert.equal(state.teamScores["1"], 20);
    assert.equal(state.teamScores["2"], 0);
    groupQuizTimedOut = true;
  }
  assert.equal(groupQuizTimedOut, true, "An incomplete simultaneous quiz should be resolved by a Durable Object Alarm");

  host.socket.send(JSON.stringify({ type: "END_GAME", actionId: crypto.randomUUID(), expectedVersion: state.version }));
  state = await host.waitFor((next) => next.status === "FINALIZED");
  assert.equal(state.winnerIds.length > 0, true);

  let resultsPayload;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const response = await fetch(new URL(`/api/v1/rooms/${hostSession.room.id}/results`, baseUrl), withTeacherAuth());
    if (response.ok) {
      resultsPayload = await response.json();
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  assert.ok(resultsPayload, "Final results should be persisted to D1");
  assert.equal(resultsPayload.results.length, 2);
  assert.equal(resultsPayload.results.every((result) => result.answersCount === 1), true);
  assert.equal(resultsPayload.results.find((result) => result.teamNumber === 1).teamScore, 20);
  assert.equal(resultsPayload.responses.length, 2);
  assert.equal(resultsPayload.responses.filter((response) => response.timedOut).length, 1);
  assert.equal(resultsPayload.responses.find((response) => response.participantId === hostSession.participant.id).submittedAnswer, "규장각");
  console.log(`Realtime team, simultaneous timeout, and detailed results smoke passed for room ${hostSession.room.code} at version ${state.version}.`);
} finally {
  host.socket.close(1000, "Smoke test complete");
  player.socket.close(1000, "Smoke test complete");
}
