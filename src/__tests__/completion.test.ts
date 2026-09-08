/**
 * The completion rule, tested against the eleven sessions actually logged in
 * the spreadsheet between 17 August and 16 September 2026, plus the edge
 * cases the rule was designed around.
 *
 * The expected outcomes come from §3.4 of the project plan, computed
 * independently from the raw spreadsheet before any of this code existed.
 *
 * Run: npm test
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  evaluateSession,
  evaluateMuscleGroup,
  isSetLogged,
  exercisesLoggedForGroup,
  exercisesForMuscleGroup,
  outstandingGroups,
  requirementsForFamily,
  indexById,
} from "../domain/completion.ts";
import { seedCatalogue } from "../db/seed.ts";
import type { Exercise, Session, SetEntry } from "../domain/types.ts";

const exercises = seedCatalogue.exercises;
const exercisesById = indexById(exercises);

// ---------------------------------------------------------------------------
// Rule 1 — what counts as logged
// ---------------------------------------------------------------------------

const liftExercise: Exercise = {
  id: "m",
  name: "Test exercise",
  aliases: [],
  tracking: "weightReps",
  weightIncrementKg: 2.5,
  defaultRestSeconds: 90,
};
const timedExercise: Exercise = { ...liftExercise, id: "t", tracking: "duration" };

function set(partial: Partial<SetEntry>): SetEntry {
  return {
    id: "s",
    exerciseId: "m",
    muscleGroupId: "g",
    setNumber: 1,
    completed: true,
    skipped: false,
    ...partial,
  };
}

test("a set needs both reps and weight to count", () => {
  assert.equal(isSetLogged(set({ reps: 10, weightKg: 60 }), "weightReps"), true);
  assert.equal(isSetLogged(set({ reps: 10, weightKg: null }), "weightReps"), false);
  assert.equal(isSetLogged(set({ reps: null, weightKg: 60 }), "weightReps"), false);
  assert.equal(isSetLogged(set({ reps: 0, weightKg: 60 }), "weightReps"), false);
});

test("zero weight counts — a bodyweight sled is still a logged set", () => {
  assert.equal(isSetLogged(set({ reps: 10, weightKg: 0 }), "weightReps"), true);
});

test("skipped sets never count, whatever numbers they carry", () => {
  assert.equal(
    isSetLogged(set({ reps: 10, weightKg: 60, skipped: true }), "weightReps"),
    false,
  );
  assert.equal(
    isSetLogged(set({ reps: 10, weightKg: 60, completed: false }), "weightReps"),
    false,
  );
});

test("timed exercises need a duration, not reps and weight", () => {
  assert.equal(isSetLogged(set({ durationSeconds: 1200 }), "duration"), true);
  assert.equal(isSetLogged(set({ reps: 10, weightKg: 60 }), "duration"), false);
});

// ---------------------------------------------------------------------------
// Rule 2 — muscle groups
// ---------------------------------------------------------------------------

function session(sets: SetEntry[], requirements: Session["requirements"]): Session {
  return {
    id: "test",
    familyId: "push",
    date: "2026-09-02",
    startedAt: "2026-09-02T18:00:00Z",
    status: "finished",
    requirements,
    sets,
  };
}

test("several sets on one exercise count as one exercise", () => {
  const s = session(
    [
      set({ id: "1", setNumber: 1, reps: 10, weightKg: 60 }),
      set({ id: "2", setNumber: 2, reps: 10, weightKg: 60 }),
      set({ id: "3", setNumber: 3, reps: 8, weightKg: 62.5 }),
    ],
    [{ muscleGroupId: "g", requiredExerciseCount: 2 }],
  );
  const outcome = evaluateSession(s, { exercises: [liftExercise] });
  assert.equal(outcome.groups[0]?.loggedCount, 1);
  assert.equal(outcome.successful, false);
});

test("the same exercise logged for two groups counts once for each, not twice for either", () => {
  // Hammer curl, logged for biceps and then for forearms in one session.
  const hammerCurl = exercisesById.get("hammer-curl")!;
  const s = session(
    [
      set({ id: "1", exerciseId: "hammer-curl", muscleGroupId: "biceps", reps: 10, weightKg: 50 }),
      set({ id: "2", exerciseId: "hammer-curl", muscleGroupId: "forearms", reps: 10, weightKg: 40 }),
    ],
    [
      { muscleGroupId: "biceps", requiredExerciseCount: 1 },
      { muscleGroupId: "forearms", requiredExerciseCount: 1 },
      { muscleGroupId: "back", requiredExerciseCount: 1 },
    ],
  );
  const outcome = evaluateSession(s, { exercises: [hammerCurl] });

  assert.deepEqual(
    outcome.groups.find((g) => g.muscleGroupId === "biceps")?.exerciseIds,
    ["hammer-curl"],
  );
  assert.deepEqual(
    outcome.groups.find((g) => g.muscleGroupId === "forearms")?.exerciseIds,
    ["hammer-curl"],
  );
  // And it does nothing for a group it was not logged against.
  assert.equal(
    outcome.groups.find((g) => g.muscleGroupId === "back")?.loggedCount,
    0,
  );
  assert.equal(outcome.successful, false);
});

test("chest requiring two exercises is not met by one", () => {
  const outcome = evaluateMuscleGroup(
    session(
      [set({ id: "1", exerciseId: "pec-fly", muscleGroupId: "chest", reps: 10, weightKg: 75 })],
      [],
    ),
    "chest",
    2,
    exercisesById,
  );
  assert.equal(outcome.loggedCount, 1);
  assert.equal(outcome.met, false);
});

test("a required count of zero makes a group optional and never blocking", () => {
  const s = session([], [{ muscleGroupId: "forearms", requiredExerciseCount: 0 }]);
  const outcome = evaluateSession(s, { exercises });
  assert.equal(outcome.groups[0]?.optional, true);
  assert.equal(outcome.groups[0]?.met, true);
  assert.equal(outcome.successful, true);
  // But an empty session is not attendance.
  assert.equal(outcome.attended, false);
});

test("optional groups are excluded from the met/total score", () => {
  const s = session(
    [set({ id: "1", exerciseId: "pec-fly", muscleGroupId: "chest", reps: 10, weightKg: 75 })],
    [
      { muscleGroupId: "chest", requiredExerciseCount: 1 },
      { muscleGroupId: "forearms", requiredExerciseCount: 0 },
    ],
  );
  const outcome = evaluateSession(s, { exercises });
  assert.equal(outcome.requiredGroupsMet, 1);
  assert.equal(outcome.requiredGroupsTotal, 1);
  assert.equal(outcome.successful, true);
});

test("unknown exercises are ignored rather than crashing", () => {
  const s = session(
    [set({ id: "1", exerciseId: "does-not-exist", muscleGroupId: "chest", reps: 10, weightKg: 60 })],
    [{ muscleGroupId: "chest", requiredExerciseCount: 1 }],
  );
  assert.equal(evaluateSession(s, { exercises }).successful, false);
});

// ---------------------------------------------------------------------------
// Catalogue queries
// ---------------------------------------------------------------------------

test("requirements snapshot comes from the family, in order", () => {
  assert.deepEqual(requirementsForFamily("push", seedCatalogue), [
    { muscleGroupId: "chest", requiredExerciseCount: 1 },
    { muscleGroupId: "shoulders", requiredExerciseCount: 1 },
    { muscleGroupId: "triceps", requiredExerciseCount: 1 },
  ]);
});

test("every seed mapping points at an exercise and a group that exist", () => {
  // Referential integrity, checked here rather than left to a foreign key
  // failure on first launch. A typo in an id is the likeliest seed bug.
  const exerciseIds = new Set(seedCatalogue.exercises.map((e) => e.id));
  const groupIds = new Set(seedCatalogue.muscleGroups.map((g) => g.id));

  for (const m of seedCatalogue.exerciseMuscleGroups) {
    assert.ok(exerciseIds.has(m.exerciseId), `unknown exercise ${m.exerciseId}`);
    assert.ok(groupIds.has(m.muscleGroupId), `unknown group ${m.muscleGroupId}`);
  }
  for (const f of seedCatalogue.familyMuscleGroups) {
    assert.ok(groupIds.has(f.muscleGroupId), `unknown group ${f.muscleGroupId}`);
  }
});

test("every exercise counts towards at least one muscle group", () => {
  // An exercise with no mapping can be created but never credited, so it would
  // silently do nothing.
  const mapped = new Set(seedCatalogue.exerciseMuscleGroups.map((m) => m.exerciseId));
  const orphans = seedCatalogue.exercises.filter((e) => !mapped.has(e.id)).map((e) => e.id);
  assert.deepEqual(orphans, []);
});

test("every muscle group belongs to a family", () => {
  const placed = new Set(seedCatalogue.familyMuscleGroups.map((f) => f.muscleGroupId));
  const stranded = seedCatalogue.muscleGroups.filter((g) => !placed.has(g.id)).map((g) => g.id);
  assert.deepEqual(stranded, []);
});

test("only cardio carries an implicit group, and abs no longer does", () => {
  // D18 superseded D1: abs has real muscle groups now, cardio does not.
  const implicit = seedCatalogue.muscleGroups.filter((g) => g.implicit).map((g) => g.id);
  assert.deepEqual(implicit, ["cardio-all"]);

  const abs = seedCatalogue.families.find((f) => f.id === "abs");
  assert.equal(abs?.usesMuscleGroups, true);
  const cardio = seedCatalogue.families.find((f) => f.id === "cardio");
  assert.equal(cardio?.usesMuscleGroups, false);
});

test("cardio exercises are timed or measured by distance, never by weight", () => {
  const cardio = exercisesForMuscleGroup("cardio-all", seedCatalogue);
  assert.equal(cardio.length, 6);
  for (const e of cardio) {
    assert.ok(e.tracking === "duration" || e.tracking === "distance", e.id);
  }
});

test("no exercise currently serves more than one muscle group", () => {
  // Q26's answer as things stand. The model supports it — pinned by the test
  // below — but nothing in the catalogue uses it, so this records the fact
  // rather than leaving it to be rediscovered.
  const counts = new Map();
  for (const m of seedCatalogue.exerciseMuscleGroups) {
    counts.set(m.exerciseId, (counts.get(m.exerciseId) ?? 0) + 1);
  }
  assert.deepEqual([...counts.values()].filter((n) => n > 1), []);
});

test("the model still allows an exercise to cross families", () => {
  // No seed row exercises this today, but the capability is real and the
  // completion rule depends on it, so it is pinned here rather than left to
  // be rediscovered.
  const catalogue = {
    ...seedCatalogue,
    exerciseMuscleGroups: [
      { exerciseId: "hack-squat", muscleGroupId: "quads" },
      { exerciseId: "hack-squat", muscleGroupId: "chest" },
    ],
  };
  assert.ok(exercisesForMuscleGroup("quads", catalogue).some((e) => e.id === "hack-squat"));
  assert.ok(exercisesForMuscleGroup("chest", catalogue).some((e) => e.id === "hack-squat"));
});


// ---------------------------------------------------------------------------
// Functions the deleted historical tests used to be the only cover for
// ---------------------------------------------------------------------------

test("exercisesLoggedForGroup counts distinct exercises, ignoring other groups", () => {
  const s = session(
    [
      set({ id: "1", exerciseId: "pec-fly", muscleGroupId: "chest", reps: 10, weightKg: 40 }),
      // Same exercise again — must not count twice.
      set({ id: "2", exerciseId: "pec-fly", muscleGroupId: "chest", setNumber: 2, reps: 8, weightKg: 45 }),
      set({ id: "3", exerciseId: "bench-press-flat", muscleGroupId: "chest", reps: 8, weightKg: 60 }),
      // A different group's work must not leak in.
      set({ id: "4", exerciseId: "lateral-raise", muscleGroupId: "shoulders", reps: 12, weightKg: 8 }),
      // Recorded but unusable, so not logged.
      set({ id: "5", exerciseId: "shoulder-press", muscleGroupId: "chest", reps: null, weightKg: 30 }),
    ],
    [{ muscleGroupId: "chest", requiredExerciseCount: 2 }],
  );

  const logged = exercisesLoggedForGroup(s, "chest", exercisesById).sort();
  assert.deepEqual(logged, ["bench-press-flat", "pec-fly"]);
});

test("outstandingGroups lists only what is still standing in the way", () => {
  const s = session(
    [set({ id: "1", exerciseId: "pec-fly", muscleGroupId: "chest", reps: 10, weightKg: 40 })],
    [
      { muscleGroupId: "chest", requiredExerciseCount: 1 },
      { muscleGroupId: "shoulders", requiredExerciseCount: 1 },
      // Optional, so never outstanding however little is done.
      { muscleGroupId: "triceps", requiredExerciseCount: 0 },
    ],
  );

  const outstanding = outstandingGroups(evaluateSession(s, { exercises })).map(
    (g) => g.muscleGroupId,
  );
  assert.deepEqual(outstanding, ["shoulders"]);
});

test("a timed exercise is logged on duration and contributes no weight", () => {
  assert.equal(isSetLogged(set({ durationSeconds: 900 }), timedExercise.tracking), true);
  assert.equal(isSetLogged(set({ reps: 10, weightKg: 20 }), timedExercise.tracking), false);
});
