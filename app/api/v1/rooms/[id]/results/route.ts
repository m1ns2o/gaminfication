import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../../../../../../db";
import { roomQuestionResponses, roomResults, rooms } from "../../../../../../db/schema";
import { getCreatorId, routeError, unauthorized } from "../../../../../lib/server-api";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const hostId = getCreatorId(request);
  if (!hostId) return unauthorized();
  try {
    const { id } = await params;
    const db = getDb();
    const [room] = await db.select({ id: rooms.id, status: rooms.status }).from(rooms)
      .where(and(eq(rooms.id, id), eq(rooms.hostId, hostId))).limit(1);
    if (!room) return Response.json({ error: { code: "ROOM_NOT_FOUND", message: "수업 방을 찾을 수 없습니다." } }, { status: 404 });
    if (room.status !== "FINALIZED") return Response.json({ error: { code: "RESULTS_NOT_READY", message: "게임 종료 후 결과를 확인할 수 있습니다." } }, { status: 409 });
    const results = await db.select().from(roomResults).where(eq(roomResults.roomId, id)).orderBy(asc(roomResults.rank));
    const responses = await db.select().from(roomQuestionResponses).where(eq(roomQuestionResponses.roomId, id))
      .orderBy(asc(roomQuestionResponses.questionSequence), asc(roomQuestionResponses.createdAt));
    return Response.json({ room: { id: room.id, status: room.status }, results, responses });
  } catch (error) {
    return routeError(error);
  }
}
