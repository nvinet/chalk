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
  setsRequiredFor,
  setsLoggedForGroup,
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
  minimumSets: 3,
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

/**
 * The three working sets it now takes to complete a weight/reps exercise
 * (D23).
 *
 * Most tests below are about some *other* rule — distinctness, snapshots,
 * skipping, optional groups — and only need an exercise to be done. One set
 * used to say that; this says it now. Where the number of sets is itself the
 * thing under test, the sets are still written out by hand.
 */
function completed(over: Partial<SetEntry> = {}, n = 3): SetEntry[] {
  const exerciseId = over.exerciseId ?? "m";
  const muscleGroupId = over.muscleGroupId ?? "g";
  return Array.from({ length: n }, (_, i) =>
    set({
      reps: 10,
      weightKg: 60,
      ...over,
      id: `${exerciseId}-${muscleGroupId}-${i + 1}`,
      setNumber: i + 1,
    }),
  );
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

// ---------------------------------------------------------------------------
// Rule 1 — how many sets it takes (D23)
// ---------------------------------------------------------------------------

test("three working sets complete a weight/reps exercise; two do not", () => {
  const group = (n: number) =>
    evaluateMuscleGroup(
      session(completed({}, n), []),
      "g",
      1,
      indexById([liftExercise]),
    );

  assert.equal(group(2).met, false);
  assert.equal(group(2).loggedCount, 0);
  assert.equal(group(3).met, true);
  assert.equal(group(3).loggedCount, 1);
});

test("loggedSetCount sees sets that loggedCount cannot", () => {
  // Two of three: nothing complete, but emphatically not "nothing logged".
  const outcome = evaluateMuscleGroup(
    session(completed({}, 2), []),
    "g",
    1,
    indexById([liftExercise]),
  );
  assert.equal(outcome.loggedCount, 0);
  assert.equal(outcome.loggedSetCount, 2);
  assert.equal(outcome.met, false);
});

test("a fourth set earns no second credit", () => {
  const outcome = evaluateMuscleGroup(
    session(completed({}, 4), []),
    "g",
    1,
    indexById([liftExercise]),
  );
  assert.equal(outcome.loggedCount, 1);
});

test("the threshold is the exercise's own, not a constant", () => {
  const single: Exercise = { ...liftExercise, id: "single", minimumSets: 1 };
  assert.equal(setsRequiredFor(single), 1);
  assert.equal(setsRequiredFor(liftExercise), 3);

  const outcome = evaluateMuscleGroup(
    session(completed({ exerciseId: "single" }, 1), []),
    "g",
    1,
    indexById([single]),
  );
  assert.equal(outcome.met, true);
});

test("timed and distance exercises still count on one entry", () => {
  assert.equal(setsRequiredFor(timedExercise), 1);
  const distance: Exercise = { ...liftExercise, id: "d", tracking: "distance" };
  assert.equal(setsRequiredFor(distance), 1);

  // Even though the stored minimumSets says three — a run is not three runs.
  assert.equal(timedExercise.minimumSets, 3);
  const outcome = evaluateMuscleGroup(
    session([set({ id: "1", exerciseId: "t", durationSeconds: 900 })], []),
    "g",
    1,
    indexById([timedExercise]),
  );
  assert.equal(outcome.met, true);
});

test("a minimumSets of zero cannot complete an exercise with no sets", () => {
  // A corrupt row must not hand out credit for nothing.
  const broken: Exercise = { ...liftExercise, id: "broken", minimumSets: 0 };
  assert.equal(setsRequiredFor(broken), 1);

  const outcome = evaluateMuscleGroup(
    session([], []),
    "g",
    1,
    indexById([broken]),
  );
  assert.equal(outcome.met, false);
});

test("warm-ups contribute none of the three", () => {
  const warmups = completed({ warmup: true }, 3);
  const outcome = evaluateMuscleGroup(
    session(warmups, []),
    "g",
    1,
    indexById([liftExercise]),
  );
  assert.equal(outcome.met, false);

  const counts = setsLoggedForGroup(
    session([...warmups, ...completed({}, 3)], []),
    "g",
    indexById([liftExercise]),
  );
  assert.equal(counts.get("m"), 3);
});

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
      ...completed({ exerciseId: "hammer-curl", muscleGroupId: "biceps", weightKg: 50 }),
      ...completed({ exerciseId: "hammer-curl", muscleGroupId: "forearms", weightKg: 40 }),
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
      completed({ exerciseId: "pec-fly", muscleGroupId: "chest", weightKg: 75 }),
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
    completed({ exerciseId: "pec-fly", muscleGroupId: "chest", weightKg: 75 }),
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
      // Three sets, one exercise — a fourth would still not count twice.
      ...completed({ exerciseId: "pec-fly", muscleGroupId: "chest", weightKg: 40 }),
      set({ id: "extra", exerciseId: "pec-fly", muscleGroupId: "chest", setNumber: 4, reps: 8, weightKg: 45 }),
      ...completed({ exerciseId: "bench-press-flat", muscleGroupId: "chest", weightKg: 60 }),
      // A different group's work must not leak in.
      ...completed({ exerciseId: "lateral-raise", muscleGroupId: "shoulders", weightKg: 8 }),
      // Recorded but unusable, so not logged however many there are.
      set({ id: "5", exerciseId: "shoulder-press", muscleGroupId: "chest", reps: null, weightKg: 30 }),
    ],
    [{ muscleGroupId: "chest", requiredExerciseCount: 2 }],
  );

  const logged = exercisesLoggedForGroup(s, "chest", exercisesById).sort();
  assert.deepEqual(logged, ["bench-press-flat", "pec-fly"]);
});

test("outstandingGroups lists only what is still standing in the way", () => {
  const s = session(
    completed({ exerciseId: "pec-fly", muscleGroupId: "chest", weightKg: 40 }),
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

// ---------------------------------------------------------------------------
// The requirement snapshot (#19)
// ---------------------------------------------------------------------------

test("a session is scored against its own snapshot, not the current family", () => {
  // The session was started when chest needed one exercise. The family has
  // since been raised to two. The logged session must not change.
  const s = session(
    completed({ exerciseId: "pec-fly", muscleGroupId: "chest", weightKg: 40 }),
    [{ muscleGroupId: "chest", requiredExerciseCount: 1 }],
  );

  const raised = {
    ...seedCatalogue,
    familyMuscleGroups: seedCatalogue.familyMuscleGroups.map((f) =>
      f.muscleGroupId === "chest" ? { ...f, requiredExerciseCount: 2 } : f,
    ),
  };

  // The catalogue now asks for two...
  assert.equal(
    requirementsForFamily("push", raised).find((r) => r.muscleGroupId === "chest")
      ?.requiredExerciseCount,
    2,
  );
  // ...but the session already logged still succeeds on the one it recorded.
  assert.equal(evaluateSession(s, { exercises }).successful, true);
});

test("requirementsForFamily reads the counts as they are now", () => {
  // The other half: a session started today must pick up the current numbers.
  const raised = {
    ...seedCatalogue,
    familyMuscleGroups: seedCatalogue.familyMuscleGroups.map((f) =>
      f.muscleGroupId === "chest" ? { ...f, requiredExerciseCount: 3 } : f,
    ),
  };
  const chest = requirementsForFamily("push", raised).find(
    (r) => r.muscleGroupId === "chest",
  );
  assert.equal(chest?.requiredExerciseCount, 3);
});

// ---------------------------------------------------------------------------
// Skipping (#24)
// ---------------------------------------------------------------------------

test("a skipped group fails the session rather than silently passing", () => {
  // The whole point: skipping records why, it never satisfies.
  const s = session(
    [],
    [
      {
        muscleGroupId: "chest",
        requiredExerciseCount: 1,
        skipped: true,
        skipReason: "equipmentBusy",
      },
    ],
  );
  const outcome = evaluateSession(s, { exercises });
  assert.equal(outcome.successful, false);
  assert.equal(outcome.groups[0]?.met, false);
});

test("a skipped group carries its reason through to the outcome", () => {
  const s = session(
    [],
    [
      {
        muscleGroupId: "chest",
        requiredExerciseCount: 1,
        skipped: true,
        skipReason: "injury",
      },
    ],
  );
  const group = evaluateSession(s, { exercises }).groups[0];
  assert.equal(group?.skipped, true);
  assert.equal(group?.skipReason, "injury");
});

test("a skipped group drops out of what is outstanding", () => {
  // It still fails the session, but he has decided — pointing him back at it
  // would be nagging.
  const s = session(
    [],
    [
      { muscleGroupId: "chest", requiredExerciseCount: 1, skipped: true },
      { muscleGroupId: "shoulders", requiredExerciseCount: 1 },
    ],
  );
  const outstanding = outstandingGroups(evaluateSession(s, { exercises })).map(
    (g) => g.muscleGroupId,
  );
  assert.deepEqual(outstanding, ["shoulders"]);
});

test("logging into a skipped group still counts it as met", () => {
  // Changing his mind should not need the skip undone first.
  const s = session(
    completed({ exerciseId: "pec-fly", muscleGroupId: "chest", weightKg: 40 }),
    [
      {
        muscleGroupId: "chest",
        requiredExerciseCount: 1,
        skipped: true,
        skipReason: "equipmentBusy",
      },
    ],
  );
  const group = evaluateSession(s, { exercises }).groups[0];
  assert.equal(group?.met, true);
  assert.equal(group?.skipped, true);
});

test("a skipped set never counts as logged, whatever it records", () => {
  assert.equal(
    isSetLogged(set({ reps: 10, weightKg: 60, skipped: true }), "weightReps"),
    false,
  );
});
