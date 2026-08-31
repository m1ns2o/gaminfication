import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("build emits the vinext worker artifacts", async () => {
  await Promise.all([
    access(new URL("dist/server/index.js", root)),
    access(new URL("dist/client", root)),
    access(new URL("dist/.openai/hosting.json", root)),
    access(new URL("dist/.openai/drizzle/0000_whole_havok.sql", root)),
    access(new URL("dist/.openai/drizzle/0005_nebulous_talon.sql", root)),
    access(new URL("dist/.openai/drizzle/0006_quiet_starbolt.sql", root)),
    access(new URL("dist/.openai/drizzle/0007_heavy_devos.sql", root)),
  ]);
});

test("Classloop page and worker expose the realtime room surface", async () => {
  const [page, layout, studio, styles, auth, googleOAuth, googleStart, googleCallback, login, schema, worker, wrangler, realtimeSmoke, realtimeLocal] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("app/components/studio-app.tsx", root), "utf8"),
    readFile(new URL("app/studio.css", root), "utf8"),
    readFile(new URL("app/lib/teacher-auth.ts", root), "utf8"),
    readFile(new URL("app/lib/google-oauth.ts", root), "utf8"),
    readFile(new URL("app/api/v1/auth/google/route.ts", root), "utf8"),
    readFile(new URL("app/api/v1/auth/google/callback/route.ts", root), "utf8"),
    readFile(new URL("app/login/page.tsx", root), "utf8"),
    readFile(new URL("db/schema.ts", root), "utf8"),
    readFile(new URL("worker/index.ts", root), "utf8"),
    readFile(new URL("wrangler.jsonc", root), "utf8"),
    readFile(new URL("tests/realtime-smoke.mjs", root), "utf8"),
    readFile(new URL("tests/realtime-local.mjs", root), "utf8"),
  ]);

  assert.match(page, /getTeacherFromCookie/);
  assert.match(page, /<StudioApp\s+auth=/);
  assert.match(layout, /Classloop/);
  assert.match(studio, /useGameRoom\(\)/);
  assert.match(studio, /prepareRoom/);
  assert.match(auth, /HttpOnly; SameSite=Lax/);
  assert.match(login, /Google 계정으로 계속하기/);
  assert.doesNotMatch(login, /이메일 계정 사용하기|TeacherAuthForm/);
  assert.match(login, /google-oauth-button__label--compact/);
  assert.match(styles, /grid-template-columns: minmax\(0, 1fr\)/);
  assert.match(googleOAuth, /code_challenge_method: "S256"/);
  assert.match(googleOAuth, /constantTimeEqual\(flow\.state, state\)/);
  assert.match(googleOAuth, /email_verified/);
  assert.match(googleOAuth, /GOOGLE_OAUTH_CLIENT_SECRET/);
  assert.match(googleStart, /beginGoogleOAuth/);
  assert.match(googleCallback, /teacherSessionCookie/);
  assert.match(schema, /oauthAccounts/);
  assert.match(worker, /roomSocketMatch/);
  assert.match(worker, /export \{ GameRoom \}/);
  assert.match(wrangler, /"GAME_ROOMS"/);
  assert.match(wrangler, /"new_sqlite_classes"/);
  assert.match(realtimeSmoke, /CLASSLOOP_TEST_SESSION_TOKEN/);
  assert.match(realtimeLocal, /refuses to seed a non-local environment/);
  await assert.rejects(access(new URL("app/api/v1/auth/login/route.ts", root)));
  await assert.rejects(access(new URL("app/api/v1/auth/register/route.ts", root)));
});
