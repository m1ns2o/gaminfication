import { and, eq } from "drizzle-orm";
import { getDb } from "../../../../../db";
import { games } from "../../../../../db/schema";
import { badRequest, getCreatorId, routeError, unauthorized } from "../../../../lib/server-api";

const templates = ["LOOP_24", "RACE_24", "LINE_24", "SPIRAL_24"] as const;
const skins = ["CAMPUS", "SPACE_LAB", "ECO_EXPEDITION"] as const;
const victoryModes = ["AUTO", "SCORE", "ROUNDS", "FINISH"] as const;
const tileTypes = ["START", "QUIZ", "BONUS", "EVENT", "REST"] as const;
const playModes = ["INDIVIDUAL", "TEAM"] as const;

function boundedInteger(value: unknown, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ownerId = getCreatorId(request);
  if (!ownerId) return unauthorized();
  try {
    const { id } = await params;
    const [game] = await getDb().select().from(games).where(and(eq(games.id, id), eq(games.ownerId, ownerId))).limit(1);
    if (!game) return Response.json({ error: { code: "GAME_NOT_FOUND", message: "게임을 찾을 수 없습니다." } }, { status: 404 });
    return Response.json({ game });
  } catch (error) {
    return routeError(error);
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ownerId = getCreatorId(request);
  if (!ownerId) return unauthorized();
  try {
    const { id } = await params;
    const db = getDb();
    const [existing] = await db.select().from(games).where(and(eq(games.id, id), eq(games.ownerId, ownerId))).limit(1);
    if (!existing) return Response.json({ error: { code: "GAME_NOT_FOUND", message: "게임을 찾을 수 없습니다." } }, { status: 404 });
    const payload = await request.json() as Record<string, unknown>;
    const title = typeof payload.title === "string" ? payload.title.trim() : existing.title;
    if (!title || title.length > 80) return badRequest("TITLE_INVALID", "게임 제목은 1–80자로 입력하세요.");
    const description = typeof payload.description === "string" ? payload.description.trim() : existing.description;
    if (description.length > 500) return badRequest("DESCRIPTION_TOO_LONG", "게임 설명은 500자 이내로 입력하세요.");
    const template = templates.includes(payload.template as typeof templates[number]) ? payload.template as typeof templates[number] : existing.template;
    const skin = skins.includes(payload.skin as typeof skins[number]) ? payload.skin as typeof skins[number] : existing.skin;
    const victoryMode = victoryModes.includes(payload.victoryMode as typeof victoryModes[number]) ? payload.victoryMode as typeof victoryModes[number] : existing.victoryMode;
    const playMode = playModes.includes(payload.playMode as typeof playModes[number]) ? payload.playMode as typeof playModes[number] : existing.playMode;
    const now = new Date().toISOString();
    let tileConfigJson = existing.tileConfigJson;
    if (payload.tileTypes !== undefined) {
      if (!Array.isArray(payload.tileTypes) || payload.tileTypes.length !== 24 || !payload.tileTypes.every((type) => tileTypes.includes(type as typeof tileTypes[number]))) {
        return badRequest("TILE_CONFIG_INVALID", "24개 칸의 유형을 모두 확인하세요.");
      }
      const normalizedTiles = payload.tileTypes as Array<typeof tileTypes[number]>;
      normalizedTiles[0] = "START";
      tileConfigJson = JSON.stringify(normalizedTiles);
    }
    const [game] = await db.update(games).set({
      title,
      description,
      subject: typeof payload.subject === "string" ? payload.subject.trim().slice(0, 30) || "미지정" : existing.subject,
      grade: typeof payload.grade === "string" ? payload.grade.trim().slice(0, 30) || "미지정" : existing.grade,
      template,
      skin,
      victoryMode,
      targetScore: boundedInteger(payload.targetScore, existing.targetScore, 10, 1000),
      maxRounds: boundedInteger(payload.maxRounds, existing.maxRounds, 1, 50),
      tileConfigJson,
      playMode,
      teamCount: boundedInteger(payload.teamCount, existing.teamCount, 2, 8),
      updatedAt: now,
    }).where(eq(games.id, id)).returning();
    return Response.json({ game });
  } catch (error) {
    return routeError(error);
  }
}
