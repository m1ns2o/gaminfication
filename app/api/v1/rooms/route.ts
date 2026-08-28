import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { games, rooms } from "../../../../db/schema";
import { badRequest, getCreatorId, routeError, unauthorized } from "../../../lib/server-api";

async function makeRoomCode() {
  const db = getDb();
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
    const existing = await db.select({ id: rooms.id }).from(rooms).where(eq(rooms.code, code)).limit(1);
    if (existing.length === 0) return code;
  }
  throw new Error("ROOM_CODE_EXHAUSTED");
}

export async function POST(request: Request) {
  const hostId = getCreatorId(request);
  if (!hostId) return unauthorized();
  try {
    const payload = await request.json() as { gameId?: string };
    if (!payload.gameId) return badRequest("GAME_ID_REQUIRED", "방을 만들 게임을 선택하세요.");
    const db = getDb();
    const ownedGame = await db.select({ id: games.id }).from(games).where(and(eq(games.id, payload.gameId), eq(games.ownerId, hostId))).limit(1);
    if (ownedGame.length === 0) return badRequest("GAME_NOT_FOUND", "게임을 찾을 수 없습니다.");
    const now = new Date();
    const code = await makeRoomCode();
    const [room] = await db.insert(rooms).values({
      id: crypto.randomUUID(), gameId: payload.gameId, hostId, code, status: "LOBBY",
      stateJson: JSON.stringify({ round: 1, turn: 0, positions: {}, scores: {} }),
      createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + 6 * 60 * 60 * 1000).toISOString(),
    }).returning();
    return Response.json({ room: { id: room.id, code: room.code, status: room.status } }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
