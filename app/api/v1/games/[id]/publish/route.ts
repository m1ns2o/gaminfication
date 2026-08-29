import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../../../db";
import { games, gameVersions } from "../../../../../../db/schema";
import { getCreatorId, routeError, unauthorized } from "../../../../../lib/server-api";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ownerId = await getCreatorId(request);
  if (!ownerId) return unauthorized();
  try {
    const { id } = await params;
    const db = getDb();
    const [game] = await db.select().from(games).where(and(eq(games.id, id), eq(games.ownerId, ownerId))).limit(1);
    if (!game) return Response.json({ error: { code: "GAME_NOT_FOUND", message: "게임을 찾을 수 없습니다." } }, { status: 404 });
    const current = await db.select({ versionNumber: gameVersions.versionNumber }).from(gameVersions).where(eq(gameVersions.gameId, id));
    const versionNumber = Math.max(0, ...current.map((version) => version.versionNumber)) + 1;
    const now = new Date().toISOString();
    const [version] = await db.insert(gameVersions).values({
      id: crypto.randomUUID(), gameId: id, versionNumber, immutable: true,
      reviewStatus: game.visibility === "PUBLIC" ? "PENDING_REVIEW" : "PRIVATE",
      definitionJson: JSON.stringify({ template: game.template, skin: game.skin, questionsCount: game.questionsCount, cardsCount: game.cardsCount }),
      createdAt: now,
    }).returning();
    await db.update(games).set({ status: game.visibility === "PUBLIC" ? "PENDING_REVIEW" : "PUBLISHED", updatedAt: now }).where(eq(games.id, id));
    return Response.json({ version });
  } catch (error) {
    return routeError(error);
  }
}
