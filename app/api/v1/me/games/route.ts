import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { games } from "../../../../../db/schema";
import { badRequest, getCreatorId, routeError, unauthorized } from "../../../../lib/server-api";

const templates = ["LOOP_24", "RACE_24", "LINE_24", "SPIRAL_24"] as const;

const demoGames = [
  { title: "조선 후기, 변화의 길", description: "영조와 정조부터 개항 전까지 핵심 흐름을 복습합니다.", subject: "사회", grade: "초등 6", template: "LOOP_24" as const, skin: "CAMPUS" as const, status: "DRAFT" as const, visibility: "PRIVATE" as const, questionsCount: 18, cardsCount: 8 },
  { title: "태양계 탐사 작전", description: "행성과 위성의 특징을 팀전으로 정리하는 수업 게임입니다.", subject: "과학", grade: "초등 5", template: "LOOP_24" as const, skin: "SPACE_LAB" as const, status: "PUBLISHED" as const, visibility: "PUBLIC" as const, questionsCount: 24, cardsCount: 10 },
];

export async function GET(request: Request) {
  const ownerId = getCreatorId(request);
  if (!ownerId) return unauthorized();
  try {
    const db = getDb();
    let rows = await db.select().from(games).where(eq(games.ownerId, ownerId)).orderBy(desc(games.updatedAt));
    if (rows.length === 0 && ownerId === "local-demo-teacher") {
      const now = new Date().toISOString();
      await db.insert(games).values(demoGames.map((game) => ({ ...game, id: crypto.randomUUID(), ownerId, createdAt: now, updatedAt: now })));
      rows = await db.select().from(games).where(eq(games.ownerId, ownerId)).orderBy(desc(games.updatedAt));
    }
    return Response.json({ games: rows });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  const ownerId = getCreatorId(request);
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
