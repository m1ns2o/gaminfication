import { and, count, eq, ne } from "drizzle-orm";
import { getDb } from "../../../../../../../db";
import { games, questions } from "../../../../../../../db/schema";
import { normalizeOptionalTileIndex, parseOptions, parseQuestionInput } from "../../../../../../lib/game-content";
import { badRequest, getCreatorId, routeError, unauthorized } from "../../../../../../lib/server-api";

function toQuestion(row: typeof questions.$inferSelect) {
  const { optionsJson, ...question } = row;
  return { ...question, options: parseOptions(optionsJson) };
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string; questionId: string }> }) {
  const ownerId = await getCreatorId(request);
  if (!ownerId) return unauthorized();
  try {
    const { id, questionId } = await params;
    const db = getDb();
    const [existing] = await db.select({ id: questions.id }).from(questions).innerJoin(games, eq(questions.gameId, games.id))
      .where(and(eq(questions.id, questionId), eq(questions.gameId, id), eq(games.ownerId, ownerId))).limit(1);
    if (!existing) return Response.json({ error: { code: "QUESTION_NOT_FOUND", message: "문제를 찾을 수 없습니다." } }, { status: 404 });
    let rawPayload: unknown;
    let input;
    try {
      rawPayload = await request.json();
      input = parseQuestionInput(rawPayload);
    } catch (error) {
      return badRequest("INVALID_QUESTION", error instanceof Error ? error.message : "문제 내용을 확인하세요.");
    }
    const tileIndex = normalizeOptionalTileIndex((rawPayload as Record<string, unknown>).tileIndex);
    const now = new Date().toISOString();
    // 칸을 옮겨 붙일 때 대상 칸에 다른 문제가 있다면 교체한다. (칸당 문제 1개 유지)
    if (tileIndex !== null) {
      const [displaced] = await db.select({ id: questions.id }).from(questions)
        .where(and(eq(questions.gameId, id), eq(questions.tileIndex, tileIndex), ne(questions.id, questionId))).limit(1);
      if (displaced) await db.delete(questions).where(eq(questions.id, displaced.id));
    }
    const [row] = await db.update(questions).set({ ...input, optionsJson: JSON.stringify(input.options), tileIndex, updatedAt: now })
      .where(eq(questions.id, questionId)).returning();
    await db.update(games).set({ updatedAt: now }).where(eq(games.id, id));
    return Response.json({ question: toQuestion(row) });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; questionId: string }> }) {
  const ownerId = await getCreatorId(request);
  if (!ownerId) return unauthorized();
  try {
    const { id, questionId } = await params;
    const db = getDb();
    const [existing] = await db.select({ id: questions.id }).from(questions).innerJoin(games, eq(questions.gameId, games.id))
      .where(and(eq(questions.id, questionId), eq(questions.gameId, id), eq(games.ownerId, ownerId))).limit(1);
    if (!existing) return Response.json({ error: { code: "QUESTION_NOT_FOUND", message: "문제를 찾을 수 없습니다." } }, { status: 404 });
    await db.delete(questions).where(eq(questions.id, questionId));
    const [{ value: total }] = await db.select({ value: count() }).from(questions).where(eq(questions.gameId, id));
    await db.update(games).set({ questionsCount: total, updatedAt: new Date().toISOString() }).where(eq(games.id, id));
    return new Response(null, { status: 204 });
  } catch (error) {
    return routeError(error);
  }
}
