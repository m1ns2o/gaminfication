import assert from "node:assert/strict";

const baseUrl = process.env.CLASSLOOP_BASE_URL ?? "http://localhost:3000";

async function requestJson(path, init) {
  const response = await fetch(new URL(path, baseUrl), init);
  const payload = await response.json();
  if (!response.ok) throw new Error(`${response.status} ${JSON.stringify(payload)}`);
  return payload;
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

const gamesResponse = await requestJson("/api/v1/me/games");
assert.ok(gamesResponse.games.length > 0, "A seeded game is required");

const hostSession = await requestJson("/api/v1/rooms", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ gameId: gamesResponse.games[0].id }),
});
const playerSession = await requestJson("/api/v1/rooms/join", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ code: hostSession.room.code, nickname: "통합테스트" }),
});

const host = await connect(hostSession.realtime.websocketPath);
const player = await connect(playerSession.realtime.websocketPath);

try {
  const lobby = await host.waitFor((state) => state.players.length === 2 && state.players.every((entry) => entry.connected));
  host.socket.send(JSON.stringify({ type: "START_GAME", actionId: crypto.randomUUID(), expectedVersion: lobby.version }));

  const started = await host.waitFor((state) => state.status === "PLAYING");
  assert.equal(started.currentPlayerId, hostSession.participant.id);
  host.socket.send(JSON.stringify({ type: "ROLL_DICE", actionId: crypto.randomUUID(), expectedVersion: started.version }));

  const hostAfterRoll = await host.waitFor((state) => state.lastEvent.type === "DICE_ROLLED");
  const playerAfterRoll = await player.waitFor((state) => state.version === hostAfterRoll.version);
  assert.equal(playerAfterRoll.lastRoll, hostAfterRoll.lastRoll);
  assert.equal(playerAfterRoll.currentPlayerId, playerSession.participant.id);
  assert.equal(hostAfterRoll.players.find((entry) => entry.id === hostSession.participant.id).position, hostAfterRoll.lastRoll);
  console.log(`Realtime smoke passed for room ${hostSession.room.code} at version ${hostAfterRoll.version}.`);
} finally {
  host.socket.close(1000, "Smoke test complete");
  player.socket.close(1000, "Smoke test complete");
}
