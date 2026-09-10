import assert from "node:assert/strict";
import test from "node:test";
import { normalizeTeacherEmail, safeAuthReturnTo, validAuthOrigin, validTeacherEmail } from "../app/lib/auth-validation.ts";

test("normalizes and validates teacher email addresses", () => {
  assert.equal(normalizeTeacherEmail("  ＴＥＡＣＨＥＲ@Example.COM  "), "teacher@example.com");
  assert.equal(validTeacherEmail("teacher@example.com"), true);
  assert.equal(validTeacherEmail("teacher example.com"), false);
  assert.equal(validTeacherEmail(`${"a".repeat(246)}@test.com`), false);
});

test("keeps OAuth return paths on the application origin", () => {
  assert.equal(safeAuthReturnTo("/library?subject=history#games"), "/library?subject=history#games");
  assert.equal(safeAuthReturnTo("https://evil.example/steal"), "/");
  assert.equal(safeAuthReturnTo("//evil.example/steal"), "/");
  assert.equal(safeAuthReturnTo("/api/v1/auth/logout"), "/");
  assert.equal(safeAuthReturnTo("/login"), "/");
  assert.equal(safeAuthReturnTo(undefined), "/");
});

test("accepts state-changing auth requests only from the same origin", () => {
  assert.equal(validAuthOrigin(new Request("https://boardrun.example/api/v1/auth/logout", { headers: { origin: "https://boardrun.example" } })), true);
  assert.equal(validAuthOrigin(new Request("https://boardrun.example/api/v1/auth/logout", { headers: { origin: "https://evil.example" } })), false);
  assert.equal(validAuthOrigin(new Request("https://boardrun.example/api/v1/auth/logout")), false);
});
