import { and, count, eq, ne } from "drizzle-orm";
import { getDb } from "../../../../../../../db";
import { cards, games } from "../../../../../../../db/schema";
import { normalizeOptionalTileIndex, parseCardInput } from "../../../../../../lib/game-content";
import { badRequest, getCreatorId, routeError, unauthorized } from "../../../../../../lib/server-api";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string; cardId: string }> }) {
  const ownerId = await getCreatorId(request);
  if (!ownerId) return unauthorized();
  try {
    const { id, cardId } = await params;
    const db = getDb();
    const [existing] = await db.select({ id: cards.id }).from(cards).innerJoin(games, eq(cards.gameId, games.id))
      .where(and(eq(cards.id, cardId), eq(cards.gameId, id), eq(games.ownerId, ownerId))).limit(1);
    if (!existing) return Response.json({ error: { code: "CARD_NOT_FOUND", message: "카드를 찾을 수 없습니다." } }, { status: 404 });
    let rawPayload: unknown;
    let input;
    try {
      rawPayload = await request.json();
      input = parseCardInput(rawPayload);
    } catch (error) {
      return badRequest("INVALID_CARD", error instanceof Error ? error.message : "카드 내용을 확인하세요.");
    }
    const tileIndex = normalizeOptionalTileIndex((rawPayload as Record<string, unknown>).tileIndex);
    const now = new Date().toISOString();
    // 칸을 옮겨 붙일 때 대상 칸에 다른 카드가 있다면 교체한다. (칸당 카드 1개 유지)
    if (tileIndex !== null) {
      const [displaced] = await db.select({ id: cards.id }).from(cards)
        .where(and(eq(cards.gameId, id), eq(cards.tileIndex, tileIndex), ne(cards.id, cardId))).limit(1);
      if (displaced) await db.delete(cards).where(eq(cards.id, displaced.id));
    }
    const [card] = await db.update(cards).set({ ...input, tileIndex, updatedAt: now }).where(eq(cards.id, cardId)).returning();
    await db.update(games).set({ updatedAt: now }).where(eq(games.id, id));
    return Response.json({ card });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; cardId: string }> }) {
  const ownerId = await getCreatorId(request);
  if (!ownerId) return unauthorized();
  try {
    const { id, cardId } = await params;
    const db = getDb();
    const [existing] = await db.select({ id: cards.id }).from(cards).innerJoin(games, eq(cards.gameId, games.id))
      .where(and(eq(cards.id, cardId), eq(cards.gameId, id), eq(games.ownerId, ownerId))).limit(1);
    if (!existing) return Response.json({ error: { code: "CARD_NOT_FOUND", message: "카드를 찾을 수 없습니다." } }, { status: 404 });
    await db.delete(cards).where(eq(cards.id, cardId));
    const [{ value: total }] = await db.select({ value: count() }).from(cards).where(eq(cards.gameId, id));
    await db.update(games).set({ cardsCount: total, updatedAt: new Date().toISOString() }).where(eq(games.id, id));
    return new Response(null, { status: 204 });
  } catch (error) {
    return routeError(error);
  }
}
