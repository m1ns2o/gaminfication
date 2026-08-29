import { and, count, eq } from "drizzle-orm";
import { getDb } from "../../../../../../../db";
import { games, questions } from "../../../../../../../db/schema";
import { parseOptions, parseQuestionInput } from "../../../../../../lib/game-content";
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
    let input;
    try {
      input = parseQuestionInput(await request.json());
    } catch (error) {
      return badRequest("INVALID_QUESTION", error instanceof Error ? error.message : "문제 내용을 확인하세요.");
    }
    const now = new Date().toISOString();
    const [row] = await db.update(questions).set({ ...input, optionsJson: JSON.stringify(input.options), updatedAt: now })
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
