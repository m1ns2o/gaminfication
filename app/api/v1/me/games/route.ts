import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { cards, games } from "../../../../../db/schema";
import { defaultCardPack } from "../../../../lib/default-content";
import { badRequest, getCreatorId, routeError, unauthorized } from "../../../../lib/server-api";

const templates = ["LOOP_24"] as const;

export async function GET(request: Request) {
  const ownerId = await getCreatorId(request);
  if (!ownerId) return unauthorized();
  try {
    const db = getDb();
    const rows = await db.select().from(games).where(eq(games.ownerId, ownerId)).orderBy(desc(games.updatedAt));
    return Response.json({ games: rows });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  const ownerId = await getCreatorId(request);
  if (!ownerId) return unauthorized();
  try {
    const payload = await request.json() as Partial<typeof games.$inferInsert>;
    const title = payload.title?.trim();
    if (!title) return badRequest("TITLE_REQUIRED", "게임 제목을 입력하세요.");
    const now = new Date().toISOString();
    const [game] = await getDb().insert(games).values({
      id: crypto.randomUUID(), ownerId, title,
      description: payload.description ?? "",
      subject: payload.subject ?? "미지정",
      grade: payload.grade ?? "미지정",
      template: templates.includes(payload.template as typeof templates[number]) ? payload.template as typeof templates[number] : "LOOP_24",
      skin: payload.skin === "SPACE_LAB" || payload.skin === "ECO_EXPEDITION" ? payload.skin : "CAMPUS",
      status: "DRAFT", visibility: "PRIVATE", createdAt: now, updatedAt: now,
    }).returning();
    // 기본 카드 풀(모노폴리·부루마블식 보드카드)을 공용 풀로 넣어 바로 플레이 가능하게 한다.
    if (defaultCardPack.length > 0) {
      await getDb().insert(cards).values(defaultCardPack.map((card, orderIndex) => ({
        ...card,
        id: crypto.randomUUID(),
        gameId: game.id,
        tileIndex: null,
        orderIndex,
        createdAt: now,
        updatedAt: now,
      })));
      await getDb().update(games).set({ cardsCount: defaultCardPack.length, updatedAt: now }).where(eq(games.id, game.id));
    }
    const [updatedGame] = await getDb().select().from(games).where(eq(games.id, game.id)).limit(1);
    return Response.json({ game: updatedGame }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
