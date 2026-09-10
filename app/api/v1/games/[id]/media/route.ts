import { and, eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { getDb } from "../../../../../../db";
import { games } from "../../../../../../db/schema";
import { badRequest, getCreatorId, routeError, unauthorized } from "../../../../../lib/server-api";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const allowedImageTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
  ["image/gif", "gif"],
]);

// 문제 이미지 업로드 — R2(boardrun-media)에 저장하고 앱 제공 경로를 돌려준다.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ownerId = await getCreatorId(request);
  if (!ownerId) return unauthorized();
  try {
    const { id } = await params;
    const [game] = await getDb().select({ id: games.id }).from(games)
      .where(and(eq(games.id, id), eq(games.ownerId, ownerId))).limit(1);
    if (!game) return Response.json({ error: { code: "GAME_NOT_FOUND", message: "게임을 찾을 수 없습니다." } }, { status: 404 });

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return badRequest("FILE_REQUIRED", "이미지 파일을 첨부하세요.");
    const extension = allowedImageTypes.get(file.type);
    if (!extension) return badRequest("FILE_TYPE_INVALID", "JPG·PNG·WebP·GIF 이미지만 업로드할 수 있습니다.");
    if (file.size > MAX_IMAGE_BYTES) return badRequest("FILE_TOO_LARGE", "이미지는 5MB 이하로 올려 주세요.");

    const key = `q-${crypto.randomUUID()}.${extension}`;
    await env.MEDIA.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
    return Response.json({ url: `/media/${key}` }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}