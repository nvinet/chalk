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
  machinesLoggedForGroup,
  machinesForMuscleGroup,
  outstandingGroups,
  requirementsForFamily,
  indexById,
} from "../domain/completion.ts";
import { seedCatalogue } from "../db/seed.ts";
import { historicalSessions, needsFixtures } from "./fixtures.generated.ts";
import type { Machine, Session, SetEntry } from "../domain/types.ts";

const machines = seedCatalogue.machines;
const machinesById = indexById(machines);

/** Every historical session used a required count of 1 for every group. */
function outcomeFor(id: string) {
  const session = historicalSessions.find((s) => s.id === id);
  if (!session) throw new Error(`fixture ${id} missing`);
  return evaluateSession(session, { machines });
}

// ---------------------------------------------------------------------------
// The historical record
// ---------------------------------------------------------------------------

test("scores the eleven logged sessions exactly as §3.4 of the plan does", needsFixtures, () => {
  const expected: Record<string, boolean> = {
    "legs-20260817": true,
    "push-20260818": true,
    "pull-20260819": false, // forearms: one machine, marked N/A
    "push-20260820": false, // no chest machine at all
    "legs-20260821": true, // spreadsheet failed this only on its column count
    "push-20260822": false, // no tricep machine at all
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
    (s) => evaluateSession(s, { machines }).successful,
  );
  assert.equal(passes.length, 5);
});

test("legs improves where the spreadsheet's all-or-nothing rule failed", needsFixtures, () => {
  // 21 and 31 August were real, complete workouts that the tick sheet failed.
  for (const id of ["legs-20260821", "legs-20260831"]) {
    assert.equal(outcomeFor(id).successful, true);
  }
});

test("31 August legs passes because quads had a second machine", needsFixtures, () => {
  const outcome = outcomeFor("legs-20260831");
  const quads = outcome.groups.find((g) => g.muscleGroupId === "quads");
  // Hack squat was recorded as "No"; the quad extension carried the group.
  assert.deepEqual(quads?.machineIds, ["quad-extension"]);
  assert.equal(quads?.met, true);
});

test("pull fails on forearms, a group with a single machine", needsFixtures, () => {
  for (const id of ["pull-20260819", "pull-20260823"]) {
    const forearms = outcomeFor(id).groups.find(
      (g) => g.muscleGroupId === "forearms",
    );
    assert.equal(forearms?.loggedCount, 0);
    assert.equal(forearms?.met, false);
  }
});

test("29 August pull did four back machines and no arm work at all", needsFixtures, () => {
  const outcome = outcomeFor("pull-20260829");
  const back = outcome.groups.find((g) => g.muscleGroupId === "back");
  const biceps = outcome.groups.find((g) => g.muscleGroupId === "biceps");
  assert.equal(back?.loggedCount, 4);
  // The rows must not credit biceps. This is the whole reason the muscle
  // group lives on the set rather than being inferred from the machine.
  assert.equal(biceps?.loggedCount, 0);
  assert.equal(outcome.successful, false);
});

// ---------------------------------------------------------------------------
// Rule 1 — what counts as logged
// ---------------------------------------------------------------------------

const liftMachine: Machine = {
  id: "m",
  name: "Test machine",
  aliases: [],
  tracking: "weightReps",
  weightIncrementKg: 2.5,
  defaultRestSeconds: 90,
};
const timedMachine: Machine = { ...liftMachine, id: "t", tracking: "duration" };

function set(partial: Partial<SetEntry>): SetEntry {
  return {
    id: "s",
    machineId: "m",
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
    .sets.find((s) => s.machineId === "lateral-raise")!;
  assert.equal(lateralRaise.reps, null);
  assert.equal(isSetLogged(lateralRaise, "weightReps"), false);

  // Shoulders survived anyway, on the other two machines.
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

test("timed machines need a duration, not reps and weight", () => {
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

test("several sets on one machine count as one machine", () => {
  const s = session(
    [
      set({ id: "1", setNumber: 1, reps: 10, weightKg: 60 }),
      set({ id: "2", setNumber: 2, reps: 10, weightKg: 60 }),
      set({ id: "3", setNumber: 3, reps: 8, weightKg: 62.5 }),
    ],
    [{ muscleGroupId: "g", requiredMachineCount: 2 }],
  );
  const outcome = evaluateSession(s, { machines: [liftMachine] });
  assert.equal(outcome.groups[0]?.loggedCount, 1);
  assert.equal(outcome.successful, false);
});

test("the same machine logged for two groups counts once for each, not twice for either", () => {
  // The Smith machine, used for chest and then for shoulders in one session.
  const smith = machinesById.get("smith-machine")!;
  const s = session(
    [
      set({ id: "1", machineId: "smith-machine", muscleGroupId: "chest", reps: 10, weightKg: 50 }),
      set({ id: "2", machineId: "smith-machine", muscleGroupId: "shoulders", reps: 10, weightKg: 40 }),
    ],
    [
      { muscleGroupId: "chest", requiredMachineCount: 1 },
      { muscleGroupId: "shoulders", requiredMachineCount: 1 },
      { muscleGroupId: "triceps", requiredMachineCount: 1 },
    ],
  );
  const outcome = evaluateSession(s, { machines: [smith] });

  assert.deepEqual(
    outcome.groups.find((g) => g.muscleGroupId === "chest")?.machineIds,
    ["smith-machine"],
  );
  assert.deepEqual(
    outcome.groups.find((g) => g.muscleGroupId === "shoulders")?.machineIds,
    ["smith-machine"],
  );
  // And it does nothing for a group it was not logged against.
  assert.equal(
    outcome.groups.find((g) => g.muscleGroupId === "triceps")?.loggedCount,
    0,
  );
  assert.equal(outcome.successful, false);
});

test("chest requiring two machines is not met by one", () => {
  const outcome = evaluateMuscleGroup(
    session(
      [set({ id: "1", machineId: "pec-fly", muscleGroupId: "chest", reps: 10, weightKg: 75 })],
      [],
    ),
    "chest",
    2,
    machinesById,
  );
  assert.equal(outcome.loggedCount, 1);
  assert.equal(outcome.met, false);
});

test("a required count of zero makes a group optional and never blocking", () => {
  const s = session([], [{ muscleGroupId: "forearms", requiredMachineCount: 0 }]);
  const outcome = evaluateSession(s, { machines });
  assert.equal(outcome.groups[0]?.optional, true);
  assert.equal(outcome.groups[0]?.met, true);
  assert.equal(outcome.successful, true);
  // But an empty session is not attendance.
  assert.equal(outcome.attended, false);
});

test("optional groups are excluded from the met/total score", () => {
  const s = session(
    [set({ id: "1", machineId: "pec-fly", muscleGroupId: "chest", reps: 10, weightKg: 75 })],
    [
      { muscleGroupId: "chest", requiredMachineCount: 1 },
      { muscleGroupId: "forearms", requiredMachineCount: 0 },
    ],
  );
  const outcome = evaluateSession(s, { machines });
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

test("unknown machines are ignored rather than crashing", () => {
  const s = session(
    [set({ id: "1", machineId: "does-not-exist", muscleGroupId: "chest", reps: 10, weightKg: 60 })],
    [{ muscleGroupId: "chest", requiredMachineCount: 1 }],
  );
  assert.equal(evaluateSession(s, { machines }).successful, false);
});

// ---------------------------------------------------------------------------
// Catalogue queries
// ---------------------------------------------------------------------------

test("requirements snapshot comes from the family, in order", () => {
  assert.deepEqual(requirementsForFamily("push", seedCatalogue), [
    { muscleGroupId: "chest", requiredMachineCount: 1 },
    { muscleGroupId: "shoulders", requiredMachineCount: 1 },
    { muscleGroupId: "triceps", requiredMachineCount: 1 },
  ]);
});

test("a machine's mapping puts it under several groups across families", () => {
  const chest = machinesForMuscleGroup("chest", seedCatalogue).map((m) => m.machine.id);
  const shoulders = machinesForMuscleGroup("shoulders", seedCatalogue).map((m) => m.machine.id);
  const quads = machinesForMuscleGroup("quads", seedCatalogue).map((m) => m.machine.id);

  assert.ok(chest.includes("smith-machine"));
  assert.ok(shoulders.includes("smith-machine"));
  assert.ok(quads.includes("smith-machine")); // legs — a different family
});

test("the machine list carries the variant label for the group", () => {
  const forChest = machinesForMuscleGroup("chest", seedCatalogue)
    .find((m) => m.machine.id === "smith-machine");
  const forQuads = machinesForMuscleGroup("quads", seedCatalogue)
    .find((m) => m.machine.id === "smith-machine");
  assert.equal(forChest?.variant, "incline press");
  assert.equal(forQuads?.variant, "squat");
});

test("machinesLoggedForGroup ignores other groups' work", needsFixtures, () => {
  const s = historicalSessions.find((s) => s.id === "pull-20260819")!;
  const back = machinesLoggedForGroup(s, "back", machinesById);
  assert.ok(back.includes("cable-station")); // the cable pull-up
  const forearms = machinesLoggedForGroup(s, "forearms", machinesById);
  // Same cable station, but the forearm curl was N/A, so it earns nothing here.
  assert.deepEqual(forearms, []);
});
