import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { cards, games, questions, roomParticipants, rooms } from "../../../../db/schema";
import { parseOptions } from "../../../lib/game-content";
import { boardGeometries, defaultTileTypes, type TileType } from "../../../lib/board";
import { gameRoomWebSocketPath, initializeGameRoom } from "../../../lib/game-room-server";
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

function roomTileTypes(value: string) {
  try {
    const parsed = JSON.parse(value) as unknown;
    const allowed: TileType[] = ["START", "QUIZ", "BONUS", "EVENT", "REST"];
    if (Array.isArray(parsed) && parsed.length === 24 && parsed.every((type) => allowed.includes(type as TileType))) return parsed as TileType[];
  } catch {
    // Fall back to the documented board template.
  }
  return defaultTileTypes;
}

export async function POST(request: Request) {
  const hostId = await getCreatorId(request);
  if (!hostId) return unauthorized();
  try {
    const payload = await request.json() as { gameId?: string };
    if (!payload.gameId) return badRequest("GAME_ID_REQUIRED", "방을 만들 게임을 선택하세요.");
    const db = getDb();
    const [ownedGame] = await db.select({
      id: games.id,
      title: games.title,
      template: games.template,
      skin: games.skin,
      victoryMode: games.victoryMode,
      targetScore: games.targetScore,
      maxRounds: games.maxRounds,
      tileConfigJson: games.tileConfigJson,
      playMode: games.playMode,
      teamCount: games.teamCount,
    }).from(games).where(and(eq(games.id, payload.gameId), eq(games.ownerId, hostId))).limit(1);
    if (!ownedGame) return badRequest("GAME_NOT_FOUND", "게임을 찾을 수 없습니다.");
    const [gameQuestions, gameCards] = await Promise.all([
      db.select().from(questions).where(eq(questions.gameId, ownedGame.id)),
      db.select().from(cards).where(eq(cards.gameId, ownedGame.id)),
    ]);
    const now = new Date();
    const code = await makeRoomCode();
    const participantId = crypto.randomUUID();
    const [room] = await db.insert(rooms).values({
      id: crypto.randomUUID(), gameId: payload.gameId, hostId, code, status: "LOBBY",
      stateJson: JSON.stringify({ round: 1, turn: 0, positions: {}, scores: {} }),
      createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
    }).returning();
    await db.insert(roomParticipants).values({
      id: participantId,
      roomId: room.id,
      authUserId: `host:${hostId}`,
      nickname: "진행자",
      teamNumber: ownedGame.playMode === "TEAM" ? 1 : null,
      isTeamLeader: true,
      joinedAt: now.toISOString(),
      lastSeenAt: now.toISOString(),
    });
    let registration;
    try {
      registration = await initializeGameRoom({
        roomId: room.id,
        code: room.code,
        gameId: ownedGame.id,
        gameTitle: ownedGame.title,
        template: ownedGame.template,
        skin: ownedGame.skin,
        gameRules: {
          victoryMode: ownedGame.victoryMode === "AUTO"
            ? boardGeometries[ownedGame.template].wraps ? "SCORE" : "FINISH"
            : ownedGame.victoryMode,
          targetScore: ownedGame.targetScore,
          maxRounds: ownedGame.maxRounds,
        },
        gameMode: { playMode: ownedGame.playMode, teamCount: ownedGame.teamCount },
        tileTypes: roomTileTypes(ownedGame.tileConfigJson),
        questions: gameQuestions.map((question) => ({
          id: question.id,
          type: question.type,
          prompt: question.prompt,
          options: parseOptions(question.optionsJson),
          correctAnswer: question.correctAnswer,
          explanation: question.explanation,
          points: question.points,
          timeLimitSeconds: question.timeLimitSeconds,
          answerMode: question.answerMode,
          tileIndex: question.tileIndex,
          imageUrl: question.imageUrl ?? null,
        })),
        cards: gameCards.map((card) => ({
          id: card.id,
          title: card.title,
          description: card.description,
          effectType: card.effectType,
          effectValue: card.effectValue,
          tileIndex: card.tileIndex,
        })),
        host: { id: participantId, nickname: "진행자", teamNumber: ownedGame.playMode === "TEAM" ? 1 : null },
        now: now.toISOString(),
      });
    } catch (error) {
      await db.delete(roomParticipants).where(eq(roomParticipants.id, participantId));
      await db.delete(rooms).where(eq(rooms.id, room.id));
      throw error;
    }
    return Response.json({
      room: { id: room.id, code: room.code, status: room.status },
      participant: { id: participantId, nickname: "진행자", role: "HOST" },
      realtime: {
        ticket: registration.ticket,
        websocketPath: gameRoomWebSocketPath(room.id, registration.ticket),
      },
    }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
