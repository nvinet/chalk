import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { matchesExercise, searchExercises } from "../domain/search.ts";
import type { Exercise } from "../domain/types.ts";

function exercise(name: string, aliases: string[] = []): Exercise {
  return {
    id: name.toLowerCase().replaceAll(" ", "-"),
    name,
    aliases,
    tracking: "weightReps",
    weightIncrementKg: 2.5,
    defaultRestSeconds: 90,
  };
}

const catalogue = [
  exercise("Hack squat", ["hax squat"]),
  exercise("Pec fly", ["peck fly"]),
  exercise("Rear delt fly", ["rear delt row"]),
  exercise("Jogging"),
];

describe("searching the exercise catalogue", () => {
  it("finds an exercise by the spelling the spreadsheet used", () => {
    // The whole point of keeping aliases: he types it the way he always has.
    assert.deepEqual(
      searchExercises(catalogue, "hax squat").map((e) => e.name),
      ["Hack squat"],
    );
    assert.deepEqual(
      searchExercises(catalogue, "peck fly").map((e) => e.name),
      ["Pec fly"],
    );
  });

  it("finds an exercise by its corrected name too", () => {
    assert.deepEqual(
      searchExercises(catalogue, "Hack").map((e) => e.name),
      ["Hack squat"],
    );
  });

  it("ignores case and surrounding space", () => {
    assert.ok(matchesExercise(exercise("Pec fly", ["peck fly"]), "  PECK FLY "));
  });

  it("matches inside the name, not only at the start", () => {
    assert.deepEqual(
      searchExercises(catalogue, "fly").map((e) => e.name),
      ["Pec fly", "Rear delt fly"],
    );
  });

  it("returns everything for an empty query", () => {
    assert.equal(searchExercises(catalogue, "   ").length, catalogue.length);
  });

  it("returns nothing rather than everything when there is no match", () => {
    assert.deepEqual(searchExercises(catalogue, "deadlift"), []);
  });

  it("does not match an alias that belongs to a different exercise", () => {
    // "rear delt row" is an alias of the fly, not of anything else.
    assert.deepEqual(
      searchExercises(catalogue, "rear delt row").map((e) => e.name),
      ["Rear delt fly"],
    );
  });
});
