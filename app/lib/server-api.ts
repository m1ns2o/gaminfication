import { getTeacherFromCookie } from "./teacher-auth";

export async function getCreatorId(request: Request) {
  if (request.headers.get("x-classloop-anonymous") === "true") return null;
  return (await getTeacherFromCookie(request.headers.get("cookie")))?.userId ?? null;
}

export function unauthorized() {
  return Response.json(
    { error: { code: "CREATOR_AUTH_REQUIRED", message: "제작자 로그인이 필요합니다." } },
    { status: 401 },
  );
}

export function badRequest(code: string, message: string) {
  return Response.json({ error: { code, message } }, { status: 400 });
}

export function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  const missingTable = message.includes("no such table");
  return Response.json(
    {
      error: {
        code: missingTable ? "DATABASE_MIGRATION_REQUIRED" : "SERVER_ERROR",
        message: missingTable ? "데이터베이스 마이그레이션이 필요합니다." : "요청을 처리하지 못했습니다.",
      },
    },
    { status: 500 },
  );
}
