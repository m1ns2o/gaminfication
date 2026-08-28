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
  ]);
});

test("Classloop page and worker expose the realtime room surface", async () => {
  const [page, layout, studio, worker, wrangler] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("app/components/studio-app.tsx", root), "utf8"),
    readFile(new URL("worker/index.ts", root), "utf8"),
    readFile(new URL("wrangler.jsonc", root), "utf8"),
  ]);

  assert.match(page, /getChatGPTUser\(\)/);
  assert.match(page, /<StudioApp\s+auth=/);
  assert.match(layout, /Classloop/);
  assert.match(studio, /useGameRoom\(\)/);
  assert.match(studio, /prepareRoom/);
  assert.match(worker, /roomSocketMatch/);
  assert.match(worker, /export \{ GameRoom \}/);
  assert.match(wrangler, /"GAME_ROOMS"/);
  assert.match(wrangler, /"new_sqlite_classes"/);
});
