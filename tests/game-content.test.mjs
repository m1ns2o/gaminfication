import assert from "node:assert/strict";
import test from "node:test";
import { parseCardInput, parseQuestionInput } from "../app/lib/game-content.ts";

test("validates multiple choice, short answer, and O/X question formats", () => {
  const multiple = parseQuestionInput({
    type: "MULTIPLE_CHOICE",
    prompt: "정조가 설치한 왕실 도서관은?",
    options: ["규장각", "집현전", "성균관", "승정원"],
    correctAnswer: "규장각",
    points: 20,
    timeLimitSeconds: 45,
  });
  assert.equal(multiple.type, "MULTIPLE_CHOICE");
  assert.equal(multiple.options.length, 4);

  const short = parseQuestionInput({ type: "SHORT_ANSWER", prompt: "정답을 쓰세요.", correctAnswer: "규장각" });
  assert.deepEqual(short.options, []);

  const ox = parseQuestionInput({ type: "OX", prompt: "정조는 규장각을 설치했다.", correctAnswer: "o" });
  assert.equal(ox.correctAnswer, "O");
  assert.deepEqual(ox.options, ["O", "X"]);
});

test("rejects invalid answers and normalizes educational card effects", () => {
  assert.throws(
    () => parseQuestionInput({ type: "MULTIPLE_CHOICE", prompt: "문제", options: ["가", "나"], correctAnswer: "다" }),
    /정답/,
  );
  assert.throws(() => parseQuestionInput({ type: "OX", prompt: "문제", correctAnswer: "모름" }), /O 또는 X/);

  const move = parseCardInput({ title: "앞으로!", effectType: "MOVE_FORWARD", effectValue: 99 });
  assert.equal(move.effectValue, 12);
  const extraTurn = parseCardInput({ title: "한 번 더", effectType: "EXTRA_TURN", effectValue: 10 });
  assert.equal(extraTurn.effectValue, 0);
});
