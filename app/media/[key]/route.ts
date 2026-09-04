import { env } from "cloudflare:workers";
import { routeError } from "../../lib/server-api";

// R2에 저장된 문제 이미지를 서빙한다. 키는 애플리케이션 내부 검증을 거친 이름(q-<uuid>.<ext>)만 쓴다.
export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  try {
    const { key } = await params;
    if (!/^[a-z0-9-]+\.(jpg|png|webp|gif)$/i.test(key)) return new Response("Not Found", { status: 404 });
    const object = await env.MEDIA.get(key);
    if (!object) return new Response("Not Found", { status: 404 });
    const headers = new Headers();
    headers.set("content-type", object.httpMetadata?.contentType ?? "application/octet-stream");
    headers.set("cache-control", "public, max-age=31536000, immutable");
    if (object.size) headers.set("content-length", String(object.size));
    return new Response(object.body, { headers });
  } catch (error) {
    return routeError(error);
  }
}