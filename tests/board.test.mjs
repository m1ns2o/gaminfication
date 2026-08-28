import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceBoardPosition,
  boardGeometries,
  boardGeometryIds,
  boardStepPath,
} from "../app/lib/board.ts";

test("all board geometries contain 24 unique in-bounds tiles", () => {
  assert.deepEqual(boardGeometryIds, ["LOOP_24", "RACE_24", "LINE_24", "SPIRAL_24"]);

  for (const geometry of Object.values(boardGeometries)) {
    assert.equal(geometry.tiles.length, 24, `${geometry.id} tile count`);
    assert.equal(new Set(geometry.tiles.map((tile) => `${tile.x}:${tile.y}`)).size, 24, `${geometry.id} unique coordinates`);
    for (const tile of geometry.tiles) {
      assert.ok(tile.x >= 0 && tile.x < geometry.columns, `${geometry.id} x coordinate`);
      assert.ok(tile.y >= 0 && tile.y < geometry.rows, `${geometry.id} y coordinate`);
    }
  }
});

test("loop boards wrap while finish boards clamp at the goal", () => {
  assert.equal(advanceBoardPosition("LOOP_24", 22, 4), 2);
  assert.deepEqual(boardStepPath("LOOP_24", 22, 2), [23, 0, 1, 2]);

  for (const geometryId of ["RACE_24", "LINE_24", "SPIRAL_24"]) {
    assert.equal(advanceBoardPosition(geometryId, 22, 4), 23);
    assert.equal(advanceBoardPosition(geometryId, 1, -4), 0);
    assert.deepEqual(boardStepPath(geometryId, 20, 23), [21, 22, 23]);
  }
});

test("the spiral course finishes at its center tile", () => {
  const finish = boardGeometries.SPIRAL_24.tiles.at(-1);
  assert.deepEqual({ x: finish.x, y: finish.y }, { x: 2, y: 2 });
});
