import { and, desc, eq, like, or } from "drizzle-orm";
import { getDb } from "../../../../db";
import { games } from "../../../../db/schema";
import { routeError } from "../../../lib/server-api";

export async function GET(request: Request) {
  try {
    const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
    const publicFilter = and(eq(games.visibility, "PUBLIC"), eq(games.status, "PUBLISHED"));
    const where = query
      ? and(publicFilter, or(like(games.title, `%${query}%`), like(games.description, `%${query}%`), like(games.subject, `%${query}%`)))
      : publicFilter;
    const rows = await getDb().select({
      id: games.id, title: games.title, description: games.description, subject: games.subject,
      grade: games.grade, template: games.template, skin: games.skin,
      questionsCount: games.questionsCount, cardsCount: games.cardsCount, updatedAt: games.updatedAt,
    }).from(games).where(where).orderBy(desc(games.updatedAt)).limit(30);
    return Response.json({ games: rows });
  } catch (error) {
    return routeError(error);
  }
}
