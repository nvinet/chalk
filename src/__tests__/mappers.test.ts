/**
 * The row → domain mapping (#13).
 *
 * Only the pure half is tested here. The queries in `repository.ts` need a
 * real expo-sqlite handle, which does not exist outside a simulator, so they
 * are exercised by running the app rather than by this suite.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  toFamily,
  toExercise,
  toMuscleGroup,
  toTrackingType,
  toSession,
} from "../db/mappers.ts";
import type { FamilyRow, ExerciseRow, MuscleGroupRow, SessionRow } from "../db/schema.ts";

const exerciseRow: ExerciseRow = {
  id: "hammer-curl",
  name: "Hammer curl",
  aliases: ["SM incline bench press"],
  tracking: "weightReps",
  weightIncrementKg: 2.5,
  defaultRestSeconds: 90,
  minimumSets: 3,
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

// -------------------------------------------- the session's own notes (#66)

const sessionRow: SessionRow = {
  id: "s1",
  familyId: "push",
  date: "2026-09-12",
  startedAt: "2026-09-12T18:00:00Z",
  finishedAt: null,
  status: "inProgress",
  notes: null,
};

test("a session carries its per-exercise notes", () => {
  const session = toSession(sessionRow, [], [], [
    { exerciseId: "bench-press-flat", muscleGroupId: "chest", note: "bench at 30" },
  ]);
  assert.equal(session.exerciseNotes?.length, 1);
  assert.equal(session.exerciseNotes?.[0]?.note, "bench at 30");
  // Keyed on the pairing, like a set: the same exercise for another group is
  // separate work and gets its own note.
  assert.equal(session.exerciseNotes?.[0]?.muscleGroupId, "chest");
});

test("a session with no notes maps to an empty list, not undefined", () => {
  assert.deepEqual(toSession(sessionRow, [], []).exerciseNotes, []);
});

test("the session note and the per-exercise notes are different things", () => {
  const session = toSession({ ...sessionRow, notes: "felt strong" }, [], [], [
    { exerciseId: "bench-press-flat", muscleGroupId: "chest", note: "bench at 30" },
  ]);
  assert.equal(session.notes, "felt strong");
  assert.equal(session.exerciseNotes?.[0]?.note, "bench at 30");
});
