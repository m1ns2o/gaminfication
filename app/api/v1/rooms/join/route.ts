import { and, eq, gt, sql } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { games, requestRateLimits, roomParticipants, rooms } from "../../../../../db/schema";
import { gameRoomWebSocketPath, registerGameRoomPlayer } from "../../../../lib/game-room-server";
import { badRequest, routeError } from "../../../../lib/server-api";

async function findOpenRoom(code: string) {
  return (await getDb().select({ room: rooms, playMode: games.playMode, teamCount: games.teamCount, gameTitle: games.title }).from(rooms)
    .innerJoin(games, eq(rooms.gameId, games.id)).where(and(
      eq(rooms.code, code),
      eq(rooms.status, "LOBBY"),
      gt(rooms.expiresAt, new Date().toISOString()),
    )).limit(1))[0];
}

export async function GET(request: Request) {
  try {
    const code = new URL(request.url).searchParams.get("code")?.replace(/\D/g, "") ?? "";
    if (!/^\d{6}$/.test(code)) return badRequest("ROOM_CODE_INVALID", "6자리 숫자 코드를 입력하세요.");
    const match = await findOpenRoom(code);
    if (!match) return Response.json({ error: { code: "ROOM_NOT_FOUND", message: "열려 있는 방을 찾지 못했습니다." } }, { status: 404 });
    return Response.json({ room: { code, gameTitle: match.gameTitle, playMode: match.playMode, teamCount: match.teamCount } });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { code?: string; nickname?: string; teamNumber?: number };
    const code = payload.code?.replace(/\D/g, "") ?? "";
    const nickname = payload.nickname?.trim() ?? "";
    if (!/^\d{6}$/.test(code)) return badRequest("ROOM_CODE_INVALID", "6자리 숫자 코드를 입력하세요.");
    const hasControlCharacter = [...nickname].some((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint <= 31 || codePoint === 127;
    });
    if (nickname.length < 2 || nickname.length > 12 || hasControlCharacter) return badRequest("NICKNAME_INVALID", "닉네임은 제어 문자 없이 2–12자로 입력하세요.");
    const db = getDb();
    const source = (request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0] ?? "unknown").trim().slice(0, 128);
    const bucket = Math.floor(Date.now() / 60_000);
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source));
    const fingerprint = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 24);
    const [rate] = await db.insert(requestRateLimits).values({
      key: `room-join:${bucket}:${fingerprint}`,
      count: 1,
      expiresAt: new Date((bucket + 2) * 60_000).toISOString(),
    }).onConflictDoUpdate({
      target: requestRateLimits.key,
      set: { count: sql`${requestRateLimits.count} + 1` },
    }).returning({ count: requestRateLimits.count });
    if (rate.count > 30) return Response.json({ error: { code: "JOIN_RATE_LIMITED", message: "참가 요청이 너무 많습니다. 잠시 후 다시 시도하세요." } }, { status: 429, headers: { "retry-after": "60" } });
    const match = await findOpenRoom(code);
    if (!match) return Response.json({ error: { code: "ROOM_NOT_FOUND", message: "열려 있는 방을 찾지 못했습니다." } }, { status: 404 });
    const { room } = match;
    const teamNumber = match.playMode === "TEAM" ? Number(payload.teamNumber) : null;
    if (match.playMode === "TEAM" && (!Number.isInteger(teamNumber) || !teamNumber || teamNumber < 1 || teamNumber > match.teamCount)) {
      return badRequest("TEAM_REQUIRED", `1–${match.teamCount}팀 중 하나를 선택하세요.`);
    }
    const now = new Date().toISOString();
    const authUserId = `anonymous:${crypto.randomUUID()}`;
    const [participant] = await db.insert(roomParticipants).values({ id: crypto.randomUUID(), roomId: room.id, authUserId, nickname, teamNumber, joinedAt: now, lastSeenAt: now }).returning();
    let registration;
    try {
      registration = await registerGameRoomPlayer(room.id, { id: participant.id, nickname, teamNumber, now });
    } catch (error) {
      await db.delete(roomParticipants).where(eq(roomParticipants.id, participant.id));
      throw error;
    }
    return Response.json({
      participant: { id: participant.id, nickname, role: "PLAYER", teamNumber },
      room: { id: room.id, code: room.code, status: room.status, playMode: match.playMode, teamCount: match.teamCount },
      realtime: {
        ticket: registration.ticket,
        websocketPath: gameRoomWebSocketPath(room.id, registration.ticket),
      },
    }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
