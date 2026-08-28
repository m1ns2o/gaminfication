import { env } from "cloudflare:workers";
import type { AddPlayerInput, CreateRoomInput, GameRoomState } from "../../shared/game-room";

type RoomRegistration = {
  ticket: string;
  state: GameRoomState;
};

function getRoomStub(roomId: string) {
  return env.GAME_ROOMS.getByName(roomId);
}

async function parseRegistration(response: Response): Promise<RoomRegistration> {
  const payload = await response.json() as RoomRegistration & { error?: { code: string; message: string } };
  if (!response.ok) throw new Error(payload.error?.message ?? "실시간 게임방을 준비하지 못했습니다.");
  return payload;
}

export async function initializeGameRoom(input: CreateRoomInput) {
  const response = await getRoomStub(input.roomId).fetch("https://game-room.internal/initialize", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseRegistration(response);
}

export async function registerGameRoomPlayer(roomId: string, input: AddPlayerInput) {
  const response = await getRoomStub(roomId).fetch("https://game-room.internal/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseRegistration(response);
}

export function gameRoomWebSocketPath(roomId: string, ticket: string) {
  return `/ws/rooms/${encodeURIComponent(roomId)}?ticket=${encodeURIComponent(ticket)}`;
}
