import { and, asc, count, eq } from "drizzle-orm";
import { getDb } from "../../../../../../db";
import { cards, games } from "../../../../../../db/schema";
import { normalizeOptionalTileIndex, parseCardInput } from "../../../../../lib/game-content";
import { badRequest, getCreatorId, routeError, unauthorized } from "../../../../../lib/server-api";

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
    const rows = await getDb().select().from(cards).where(eq(cards.gameId, id)).orderBy(asc(cards.orderIndex));
    return Response.json({ cards: rows });
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
    let rawPayload: unknown;
    let input;
    try {
      rawPayload = await request.json();
      input = parseCardInput(rawPayload);
    } catch (error) {
      return badRequest("INVALID_CARD", error instanceof Error ? error.message : "카드 내용을 확인하세요.");
    }
    const tileIndex = normalizeOptionalTileIndex((rawPayload as Record<string, unknown>).tileIndex);
    const db = getDb();
    const now = new Date().toISOString();
    // 칸에 고정하는 저장이라면 이미 그 칸에 카드가 있을 때 교체(갱신)한다. (칸당 카드 1개 유지)
    if (tileIndex !== null) {
      const [existingBound] = await db.select({ id: cards.id }).from(cards)
        .where(and(eq(cards.gameId, id), eq(cards.tileIndex, tileIndex))).limit(1);
      if (existingBound) {
        const [card] = await db.update(cards)
          .set({ ...input, tileIndex, updatedAt: now })
          .where(eq(cards.id, existingBound.id)).returning();
        await db.update(games).set({ updatedAt: now }).where(eq(games.id, id));
        return Response.json({ card });
      }
    }
    const [{ value: total }] = await db.select({ value: count() }).from(cards).where(eq(cards.gameId, id));
    const [card] = await db.insert(cards).values({ ...input, id: crypto.randomUUID(), gameId: id, tileIndex, orderIndex: total, createdAt: now, updatedAt: now }).returning();
    await db.update(games).set({ cardsCount: total + 1, updatedAt: now }).where(eq(games.id, id));
    return Response.json({ card }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
