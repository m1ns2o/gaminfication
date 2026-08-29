import { and, asc, count, eq } from "drizzle-orm";
import { getDb } from "../../../../../../db";
import { games, questions } from "../../../../../../db/schema";
import { parseOptions, parseQuestionInput } from "../../../../../lib/game-content";
import { badRequest, getCreatorId, routeError, unauthorized } from "../../../../../lib/server-api";

function toQuestion(row: typeof questions.$inferSelect) {
  const { optionsJson, ...question } = row;
  return { ...question, options: parseOptions(optionsJson) };
}

async function ownedGame(gameId: string, ownerId: string) {
  const [game] = await getDb().select({ id: games.id }).from(games)
    .where(and(eq(games.id, gameId), eq(games.ownerId, ownerId))).limit(1);
  return game;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ownerId = await getCreatorId(request);
  if (!ownerId) return unauthorized();
  try {
    const { id } = await params;
    if (!await ownedGame(id, ownerId)) return Response.json({ error: { code: "GAME_NOT_FOUND", message: "게임을 찾을 수 없습니다." } }, { status: 404 });
    const rows = await getDb().select().from(questions).where(eq(questions.gameId, id)).orderBy(asc(questions.orderIndex));
    return Response.json({ questions: rows.map(toQuestion) });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ownerId = await getCreatorId(request);
  if (!ownerId) return unauthorized();
  try {
    const { id } = await params;
    if (!await ownedGame(id, ownerId)) return Response.json({ error: { code: "GAME_NOT_FOUND", message: "게임을 찾을 수 없습니다." } }, { status: 404 });
    let input;
    try {
      input = parseQuestionInput(await request.json());
    } catch (error) {
      return badRequest("INVALID_QUESTION", error instanceof Error ? error.message : "문제 내용을 확인하세요.");
    }
    const db = getDb();
    const [{ value: total }] = await db.select({ value: count() }).from(questions).where(eq(questions.gameId, id));
    const now = new Date().toISOString();
    const [row] = await db.insert(questions).values({
      ...input,
      id: crypto.randomUUID(),
      gameId: id,
      optionsJson: JSON.stringify(input.options),
      orderIndex: total,
      createdAt: now,
      updatedAt: now,
    }).returning();
    await db.update(games).set({ questionsCount: total + 1, updatedAt: now }).where(eq(games.id, id));
    return Response.json({ question: toQuestion(row) }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
