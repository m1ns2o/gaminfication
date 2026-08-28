import { and, eq, gt } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { roomParticipants, rooms } from "../../../../../db/schema";
import { gameRoomWebSocketPath, registerGameRoomPlayer } from "../../../../lib/game-room-server";
import { badRequest, routeError } from "../../../../lib/server-api";

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { code?: string; nickname?: string };
    const code = payload.code?.replace(/\D/g, "") ?? "";
    const nickname = payload.nickname?.trim() ?? "";
    if (!/^\d{6}$/.test(code)) return badRequest("ROOM_CODE_INVALID", "6자리 숫자 코드를 입력하세요.");
    if (nickname.length < 2 || nickname.length > 12) return badRequest("NICKNAME_INVALID", "닉네임은 2–12자로 입력하세요.");
    const db = getDb();
    const [room] = await db.select().from(rooms).where(and(
      eq(rooms.code, code),
      eq(rooms.status, "LOBBY"),
      gt(rooms.expiresAt, new Date().toISOString()),
    )).limit(1);
    if (!room) return Response.json({ error: { code: "ROOM_NOT_FOUND", message: "열려 있는 방을 찾지 못했습니다." } }, { status: 404 });
    const now = new Date().toISOString();
    const authUserId = `anonymous:${crypto.randomUUID()}`;
    const [participant] = await db.insert(roomParticipants).values({ id: crypto.randomUUID(), roomId: room.id, authUserId, nickname, joinedAt: now, lastSeenAt: now }).returning();
    let registration;
    try {
      registration = await registerGameRoomPlayer(room.id, { id: participant.id, nickname, now });
    } catch (error) {
      await db.delete(roomParticipants).where(eq(roomParticipants.id, participant.id));
      throw error;
    }
    return Response.json({
      participant: { id: participant.id, nickname, role: "PLAYER" },
      room: { id: room.id, code: room.code, status: room.status },
      realtime: {
        ticket: registration.ticket,
        websocketPath: gameRoomWebSocketPath(room.id, registration.ticket),
      },
    }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
