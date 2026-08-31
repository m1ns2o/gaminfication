import { and, desc, eq, like, or } from "drizzle-orm";
import { getDb } from "../../../../db";
import { games } from "../../../../db/schema";
import { routeError } from "../../../lib/server-api";

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const query = params.get("q")?.trim() ?? "";
    const subject = params.get("subject")?.trim() ?? "";
    const grade = params.get("grade")?.trim() ?? "";
    const gradeStage = grade.endsWith(" 전체") ? grade.slice(0, -" 전체".length) : "";
    const publicFilter = and(eq(games.visibility, "PUBLIC"), eq(games.status, "PUBLISHED"));
    const where = and(
      publicFilter,
      query ? or(like(games.title, `%${query}%`), like(games.description, `%${query}%`), like(games.subject, `%${query}%`)) : undefined,
      subject && subject !== "전체" ? eq(games.subject, subject) : undefined,
      gradeStage ? like(games.grade, `${gradeStage}%`) : grade && grade !== "전체" ? eq(games.grade, grade) : undefined,
    );
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
