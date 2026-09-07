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
import { historicalSessions, needsFixtures } from "./fixtures.generated.ts";
import type { Exercise, Session, SetEntry } from "../domain/types.ts";

const exercises = seedCatalogue.exercises;
const exercisesById = indexById(exercises);

/** Every historical session used a required count of 1 for every group. */
function outcomeFor(id: string) {
  const session = historicalSessions.find((s) => s.id === id);
  if (!session) throw new Error(`fixture ${id} missing`);
  return evaluateSession(session, { exercises });
}

// ---------------------------------------------------------------------------
// The historical record
// ---------------------------------------------------------------------------

test("scores the eleven logged sessions exactly as §3.4 of the plan does", needsFixtures, () => {
  const expected: Record<string, boolean> = {
    "legs-20260817": true,
    "push-20260818": true,
    "pull-20260819": false, // forearms: one exercise, marked N/A
    "push-20260820": false, // no chest exercise at all
    "legs-20260821": true, // spreadsheet failed this only on its column count
    "push-20260822": false, // no tricep exercise at all
    "pull-20260823": false, // forearms again
    "pull-20260829": false, // back only
    "push-20260830": true,
    "legs-20260831": true, // hack squat "No", but quad extension carried quads
    "legs-20260916": false, // a stray "." — never a real session
  };

  for (const [id, successful] of Object.entries(expected)) {
    assert.equal(outcomeFor(id).successful, successful, `${id} scored wrongly`);
  }
});

test("five of the eleven sessions succeed", needsFixtures, () => {
  const passes = historicalSessions.filter(
    (s) => evaluateSession(s, { exercises }).successful,
  );
  assert.equal(passes.length, 5);
});

test("legs improves where the spreadsheet's all-or-nothing rule failed", needsFixtures, () => {
  // 21 and 31 August were real, complete workouts that the tick sheet failed.
  for (const id of ["legs-20260821", "legs-20260831"]) {
    assert.equal(outcomeFor(id).successful, true);
  }
});

test("31 August legs passes because quads had a second exercise", needsFixtures, () => {
  const outcome = outcomeFor("legs-20260831");
  const quads = outcome.groups.find((g) => g.muscleGroupId === "quads");
  // Hack squat was recorded as "No"; the quad extension carried the group.
  assert.deepEqual(quads?.exerciseIds, ["quad-extension"]);
  assert.equal(quads?.met, true);
});

test("pull fails on forearms, a group with a single exercise", needsFixtures, () => {
  for (const id of ["pull-20260819", "pull-20260823"]) {
    const forearms = outcomeFor(id).groups.find(
      (g) => g.muscleGroupId === "forearms",
    );
    assert.equal(forearms?.loggedCount, 0);
    assert.equal(forearms?.met, false);
  }
});

test("29 August pull did four back exercises and no arm work at all", needsFixtures, () => {
  const outcome = outcomeFor("pull-20260829");
  const back = outcome.groups.find((g) => g.muscleGroupId === "back");
  const biceps = outcome.groups.find((g) => g.muscleGroupId === "biceps");
  assert.equal(back?.loggedCount, 4);
  // The rows must not credit biceps. This is the whole reason the muscle
  // group lives on the set rather than being inferred from the exercise.
  assert.equal(biceps?.loggedCount, 0);
  assert.equal(outcome.successful, false);
});

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

test('the spreadsheet\'s "Done" entries do not count', needsFixtures, () => {
  // 30 August: lateral raises recorded as "Done" with no numbers. He was
  // logging from memory on the sofa, which is the app's whole reason to exist.
  const lateralRaise = historicalSessions
    .find((s) => s.id === "push-20260830")!
    .sets.find((s) => s.exerciseId === "lateral-raise")!;
  assert.equal(lateralRaise.reps, null);
  assert.equal(isSetLogged(lateralRaise, "weightReps"), false);

  // Shoulders survived anyway, on the other two exercises.
  const shoulders = outcomeFor("push-20260830").groups.find(
    (g) => g.muscleGroupId === "shoulders",
  );
  assert.equal(shoulders?.loggedCount, 2);
  assert.equal(shoulders?.met, true);
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

test("attendance and success are different measures", needsFixtures, () => {
  // C3: a half-done session still counts toward the weekly target.
  const outcome = outcomeFor("push-20260820");
  assert.equal(outcome.attended, true);
  assert.equal(outcome.successful, false);
});

test("outstanding groups drive the continue button", needsFixtures, () => {
  const outcome = outcomeFor("push-20260822");
  assert.deepEqual(
    outstandingGroups(outcome).map((g) => g.muscleGroupId),
    ["triceps"],
  );
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

test("one exercise can serve two muscle groups", () => {
  // The surviving many-to-many now that exercises are the grain. The Smith
  // machine used to span three groups through three movements; those are three
  // exercises today. Hammer curl is one movement worked for two groups.
  const biceps = exercisesForMuscleGroup("biceps", seedCatalogue).map((e) => e.id);
  const forearms = exercisesForMuscleGroup("forearms", seedCatalogue).map((e) => e.id);

  assert.ok(biceps.includes("hammer-curl"));
  assert.ok(forearms.includes("hammer-curl"));
});

test("the spreadsheet's three cable columns are three exercises, not one", () => {
  // The generated seed collapsed these into one "cable station" with variants.
  // The source data never did, and neither do we.
  const ids = seedCatalogue.exercises.map((e) => e.id);
  assert.ok(ids.includes("tricep-pushdown"));
  assert.ok(ids.includes("cable-pull-up"));
  assert.ok(ids.includes("cable-forearm-curl"));
  assert.ok(!ids.includes("cable-station"));
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

test("exercisesLoggedForGroup ignores other groups' work", needsFixtures, () => {
  const s = historicalSessions.find((s) => s.id === "pull-20260819")!;
  const back = exercisesLoggedForGroup(s, "back", exercisesById);
  assert.ok(back.includes("cable-station")); // the cable pull-up
  const forearms = exercisesLoggedForGroup(s, "forearms", exercisesById);
  // Same cable station, but the forearm curl was N/A, so it earns nothing here.
  assert.deepEqual(forearms, []);
});
