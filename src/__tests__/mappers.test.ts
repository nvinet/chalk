/**
 * The row → domain mapping (#13).
 *
 * Only the pure half is tested here. The queries in `repository.ts` need a
 * real expo-sqlite handle, which does not exist outside a simulator, so they
 * are exercised by running the app rather than by this suite.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { toFamily, toExercise, toMuscleGroup, toTrackingType } from "../db/mappers.ts";
import type { FamilyRow, ExerciseRow, MuscleGroupRow } from "../db/schema.ts";

const exerciseRow: ExerciseRow = {
  id: "hammer-curl",
  name: "Hammer curl",
  aliases: ["SM incline bench press"],
  tracking: "weightReps",
  weightIncrementKg: 2.5,
  defaultRestSeconds: 90,
  notes: null,
  archived: false,
};

test("an exercise row maps to a domain exercise", () => {
  const m = toExercise(exerciseRow);
  assert.equal(m.id, "hammer-curl");
  assert.equal(m.tracking, "weightReps");
  assert.deepEqual(m.aliases, ["SM incline bench press"]);
});

test("all three tracking types survive the round trip", () => {
  for (const t of ["weightReps", "duration", "distance"] as const) {
    assert.equal(toExercise({ ...exerciseRow, tracking: t }).tracking, t);
  }
});

test("an unrecognised tracking type falls back rather than throwing", () => {
  // A corrupt row or a database written by a newer build must not stop him
  // logging mid-session.
  assert.equal(toTrackingType("laps"), "weightReps");
  assert.equal(toTrackingType(""), "weightReps");
});

test("a family row maps to a domain family", () => {
  const row: FamilyRow = {
    id: "push",
    name: "Push",
    position: 1,
    usesMuscleGroups: true,
    archived: false,
  };
  assert.deepEqual(toFamily(row), {
    id: "push",
    name: "Push",
    position: 1,
    usesMuscleGroups: true,
  });
});

test("an implicit muscle group keeps its flag through the mapping", () => {
  const row: MuscleGroupRow = {
    id: "abs-all",
    name: "Abs",
    position: 11,
    implicit: true,
    archived: false,
  };
  assert.equal(toMuscleGroup(row).implicit, true);
});

test("an exercise with no aliases maps to an empty list, not undefined", () => {
  assert.deepEqual(toExercise({ ...exerciseRow, aliases: [] }).aliases, []);
});
