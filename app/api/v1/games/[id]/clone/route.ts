import { eq } from "drizzle-orm";
import { getDb } from "../../../../../../db";
import { games } from "../../../../../../db/schema";
import { getCreatorId, routeError, unauthorized } from "../../../../../lib/server-api";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ownerId = getCreatorId(request);
  if (!ownerId) return unauthorized();
  try {
    const { id } = await params;
    const db = getDb();
    const [source] = await db.select().from(games).where(eq(games.id, id)).limit(1);
    if (!source || source.visibility === "PRIVATE") return Response.json({ error: { code: "GAME_NOT_CLONEABLE", message: "복제할 수 없는 게임입니다." } }, { status: 404 });
    const now = new Date().toISOString();
    const [clone] = await db.insert(games).values({
      ...source, id: crypto.randomUUID(), ownerId, title: `${source.title} 복제본`,
      status: "DRAFT", visibility: "PRIVATE", sourceVersionId: source.id, createdAt: now, updatedAt: now,
    }).returning();
    return Response.json({ game: clone }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
