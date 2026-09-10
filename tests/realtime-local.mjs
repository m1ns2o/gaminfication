import { createHash, randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const baseUrl = new URL(process.env.BOARDRUN_BASE_URL ?? "http://localhost:3000");
if (!['localhost', '127.0.0.1', '::1'].includes(baseUrl.hostname)) {
  throw new Error("The local realtime test refuses to seed a non-local environment.");
}

const teacherId = "00000000-0000-4000-8000-000000000001";
const sessionToken = randomBytes(32).toString("base64url");
const tokenHash = createHash("sha256").update(sessionToken).digest("base64url");
const now = new Date();
const expiresAt = new Date(now.getTime() + 60 * 60 * 1000);
const sql = [
  `INSERT INTO teacher_accounts (id, email, display_name, created_at, updated_at) VALUES ('${teacherId}', 'realtime-test@boardrun.local', '실시간 테스트 교사', '${now.toISOString()}', '${now.toISOString()}') ON CONFLICT(id) DO UPDATE SET updated_at=excluded.updated_at`,
  `INSERT INTO profiles (id, display_name, avatar_url, is_anonymous, created_at, updated_at) VALUES ('${teacherId}', '실시간 테스트 교사', NULL, 0, '${now.toISOString()}', '${now.toISOString()}') ON CONFLICT(id) DO UPDATE SET updated_at=excluded.updated_at`,
  `DELETE FROM teacher_sessions WHERE teacher_id='${teacherId}'`,
  `INSERT INTO teacher_sessions (token_hash, teacher_id, created_at, expires_at) VALUES ('${tokenHash}', '${teacherId}', '${now.toISOString()}', '${expiresAt.toISOString()}')`,
].join("; ");

const wranglerEntry = fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url));
const seeded = spawnSync(process.execPath, [wranglerEntry, "d1", "execute", "site-creator-d1", "--local", "--command", sql], {
  cwd: new URL("../", import.meta.url),
  encoding: "utf8",
  stdio: "inherit",
});
if (seeded.error) throw seeded.error;
if (seeded.status !== 0) throw new Error(`Failed to seed the local teacher session (exit ${seeded.status}).`);

process.env.BOARDRUN_TEST_SESSION_TOKEN = sessionToken;
await import("./realtime-smoke.mjs");
