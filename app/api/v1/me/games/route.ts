import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { games } from "../../../../../db/schema";
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
    return Response.json({ game }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
