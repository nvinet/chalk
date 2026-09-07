/**
 * Volume, history and personal bests — all keyed on the (machine, muscle
 * group) pairing rather than the machine alone.
 */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  bestsForPairing,
  estimatedOneRepMaxKg,
  formatKg,
  lastTimeForPairing,
  personalBestsInSession,
  sessionVolumeKg,
  setVolumeKg,
  topSetSeries,
  volumeByMuscleGroup,
} from "../domain/scoring.ts";
import { indexById } from "../domain/completion.ts";
import { seedCatalogue } from "../db/seed.ts";
import { historicalSessions, needsFixtures } from "./fixtures.generated.ts";
import type { Machine, Session, SetEntry } from "../domain/types.ts";

const machines = seedCatalogue.machines;
const machinesById = indexById(machines);
const smith = machinesById.get("smith-machine")!;
const pecFly = machinesById.get("pec-fly")!;

function set(p: Partial<SetEntry>): SetEntry {
  return {
    id: Math.random().toString(36).slice(2),
    machineId: "pec-fly",
    muscleGroupId: "chest",
    setNumber: 1,
    completed: true,
    skipped: false,
    ...p,
  };
}

function session(id: string, date: string, sets: SetEntry[]): Session {
  return {
    id,
    familyId: "push",
    date,
    startedAt: `${date}T18:00:00Z`,
    status: "finished",
    requirements: [{ muscleGroupId: "chest", requiredMachineCount: 1 }],
    sets,
  };
}

// ---------------------------------------------------------------------------
// Volume
// ---------------------------------------------------------------------------

test("set volume is reps times weight, and zero for anything unrecorded", () => {
  assert.equal(setVolumeKg(set({ reps: 10, weightKg: 75 }), pecFly), 750);
  assert.equal(setVolumeKg(set({ reps: 10, weightKg: null }), pecFly), 0);
  assert.equal(setVolumeKg(set({ reps: 10, weightKg: 75, skipped: true }), pecFly), 0);
});

test("timed work contributes no volume", () => {
  const treadmill: Machine = { ...pecFly, id: "treadmill", tracking: "duration" };
  assert.equal(setVolumeKg(set({ durationSeconds: 1800 }), treadmill), 0);
});

test("volume by muscle group attributes each set to the group it was logged for", () => {
  const s = session("v", "2026-09-02", [
    set({ machineId: "smith-machine", muscleGroupId: "chest", reps: 10, weightKg: 50 }),
    set({ machineId: "smith-machine", muscleGroupId: "shoulders", reps: 10, weightKg: 40 }),
  ]);
  const byGroup = volumeByMuscleGroup([s], { machines });
  assert.equal(byGroup.get("chest")?.volumeKg, 500);
  assert.equal(byGroup.get("shoulders")?.volumeKg, 400);
  // One machine, two groups, no double counting anywhere.
  assert.equal(byGroup.get("chest")?.sets, 1);
});

test("a real session's volume matches the sets that were properly recorded", needsFixtures, () => {
  // 18 August push: all eight machines logged with numbers.
  const s = historicalSessions.find((x) => x.id === "push-20260818")!;
  const expected = s.sets.reduce(
    (t, e) => t + (e.reps ?? 0) * (e.weightKg ?? 0),
    0,
  );
  assert.equal(sessionVolumeKg(s, { machines }), expected);
  assert.ok(expected > 0);
});

// ---------------------------------------------------------------------------
// Estimated one-rep max
// ---------------------------------------------------------------------------

test("estimated 1RM uses Epley and refuses silly rep counts", () => {
  assert.equal(estimatedOneRepMaxKg(1, 100), 100);
  assert.equal(Math.round(estimatedOneRepMaxKg(10, 60)!), 80);
  assert.equal(estimatedOneRepMaxKg(30, 60), null); // the spreadsheet's totals
  assert.equal(estimatedOneRepMaxKg(0, 60), null);
});

// ---------------------------------------------------------------------------
// Last time
// ---------------------------------------------------------------------------

test("last time is per machine AND per muscle group", () => {
  const history = [
    session("a", "2026-08-01", [
      set({ machineId: "smith-machine", muscleGroupId: "chest", reps: 10, weightKg: 50 }),
      set({ machineId: "smith-machine", muscleGroupId: "shoulders", reps: 10, weightKg: 30 }),
    ]),
  ];

  const chest = lastTimeForPairing(history, { machineId: "smith-machine", muscleGroupId: "chest" }, smith);
  const shoulders = lastTimeForPairing(history, { machineId: "smith-machine", muscleGroupId: "shoulders" }, smith);

  // Same machine, same day, two different numbers. Showing the wrong one
  // mid-set would be worse than showing nothing.
  assert.equal(chest?.topSetWeightKg, 50);
  assert.equal(shoulders?.topSetWeightKg, 30);
});

test("last time returns the most recent session, not the first", () => {
  const history = [
    session("a", "2026-08-01", [set({ reps: 10, weightKg: 66 })]),
    session("b", "2026-08-22", [set({ reps: 10, weightKg: 73 })]),
    session("c", "2026-08-18", [set({ reps: 9, weightKg: 70 })]),
  ];
  const last = lastTimeForPairing(history, { machineId: "pec-fly", muscleGroupId: "chest" }, pecFly);
  assert.equal(last?.date, "2026-08-22");
  assert.equal(last?.topSetWeightKg, 73);
});

test("last time can be asked for a point in the past, for editing old sessions", () => {
  const history = [
    session("a", "2026-08-01", [set({ reps: 10, weightKg: 66 })]),
    session("b", "2026-08-22", [set({ reps: 10, weightKg: 73 })]),
  ];
  const last = lastTimeForPairing(
    history,
    { machineId: "pec-fly", muscleGroupId: "chest" },
    pecFly,
    "2026-08-22",
  );
  assert.equal(last?.date, "2026-08-01");
});

test("last time summarises uniform sets as 3×10 and mixed sets as a count", () => {
  const uniform = session("u", "2026-08-01", [
    set({ setNumber: 1, reps: 10, weightKg: 73 }),
    set({ setNumber: 2, reps: 10, weightKg: 73 }),
    set({ setNumber: 3, reps: 10, weightKg: 73 }),
  ]);
  assert.equal(
    lastTimeForPairing([uniform], { machineId: "pec-fly", muscleGroupId: "chest" }, pecFly)?.summary,
    "3×10 @ 73 kg",
  );

  const mixed = session("m", "2026-08-01", [
    set({ setNumber: 1, reps: 10, weightKg: 70 }),
    set({ setNumber: 2, reps: 8, weightKg: 75 }),
  ]);
  assert.equal(
    lastTimeForPairing([mixed], { machineId: "pec-fly", muscleGroupId: "chest" }, pecFly)?.summary,
    "2 sets @ 75 kg",
  );
});

test("last time ignores sets that were never properly recorded", () => {
  const history = [
    session("a", "2026-08-01", [set({ reps: 10, weightKg: 66 })]),
    session("b", "2026-08-22", [set({ reps: null, weightKg: null })]), // a "Done"
  ];
  const last = lastTimeForPairing(history, { machineId: "pec-fly", muscleGroupId: "chest" }, pecFly);
  assert.equal(last?.date, "2026-08-01");
});

test("no history yet returns null rather than a fake zero", () => {
  assert.equal(
    lastTimeForPairing([], { machineId: "pec-fly", muscleGroupId: "chest" }, pecFly),
    null,
  );
});

// ---------------------------------------------------------------------------
// Personal bests
// ---------------------------------------------------------------------------

test("bests are tracked per pairing", () => {
  const history = [
    session("a", "2026-08-01", [set({ reps: 10, weightKg: 66 })]),
    session("b", "2026-08-22", [set({ reps: 10, weightKg: 73 })]),
  ];
  const best = bestsForPairing(history, { machineId: "pec-fly", muscleGroupId: "chest" }, pecFly);
  assert.equal(best.heaviestKg, 73);
  assert.equal(best.bestSetVolumeKg, 730);
});

test("a heavier set than anything before it is a personal best", () => {
  const earlier = [session("a", "2026-08-01", [set({ reps: 10, weightKg: 66 })])];
  const now = session("b", "2026-08-22", [set({ reps: 10, weightKg: 73 })]);

  const bests = personalBestsInSession(now, earlier, { machines });
  const heaviest = bests.find((b) => b.kind === "heaviest");
  assert.equal(heaviest?.value, 73);
  assert.equal(heaviest?.previous, 66);
});

test("the first ever set on a pairing is a best, with no previous value", () => {
  const now = session("b", "2026-08-22", [set({ reps: 10, weightKg: 73 })]);
  const heaviest = personalBestsInSession(now, [], { machines }).find(
    (b) => b.kind === "heaviest",
  );
  assert.equal(heaviest?.previous, null);
});

test("repeating last week's numbers is not a personal best", () => {
  const earlier = [session("a", "2026-08-01", [set({ reps: 10, weightKg: 73 })])];
  const now = session("b", "2026-08-22", [set({ reps: 10, weightKg: 73 })]);
  const heaviest = personalBestsInSession(now, earlier, { machines }).filter(
    (b) => b.kind === "heaviest",
  );
  assert.equal(heaviest.length, 0);
});

test("a best on one muscle group is not a best on another", () => {
  const earlier = [
    session("a", "2026-08-01", [
      set({ machineId: "smith-machine", muscleGroupId: "chest", reps: 10, weightKg: 80 }),
    ]),
  ];
  const now = session("b", "2026-08-22", [
    set({ machineId: "smith-machine", muscleGroupId: "shoulders", reps: 10, weightKg: 40 }),
  ]);
  const bests = personalBestsInSession(now, earlier, { machines });
  // 40 kg is lighter than the 80 kg chest press, but it is the first ever
  // shoulder press on that machine, so it is a best for that pairing.
  const heaviest = bests.find((b) => b.kind === "heaviest");
  assert.equal(heaviest?.pairing.muscleGroupId, "shoulders");
  assert.equal(heaviest?.previous, null);
});

// ---------------------------------------------------------------------------
// Charts and formatting
// ---------------------------------------------------------------------------

test("the chart series is oldest first and skips sessions without the pairing", () => {
  const history = [
    session("b", "2026-08-22", [set({ reps: 10, weightKg: 73 })]),
    session("a", "2026-08-01", [set({ reps: 10, weightKg: 66 })]),
    session("c", "2026-08-10", [
      set({ machineId: "bench-press-flat", muscleGroupId: "chest", reps: 10, weightKg: 60 }),
    ]),
  ];
  assert.deepEqual(
    topSetSeries(history, { machineId: "pec-fly", muscleGroupId: "chest" }, pecFly),
    [
      { date: "2026-08-01", weightKg: 66 },
      { date: "2026-08-22", weightKg: 73 },
    ],
  );
});

test("weights print without trailing noise", () => {
  assert.equal(formatKg(73), "73 kg");
  assert.equal(formatKg(47.3), "47.3 kg");
  assert.equal(formatKg(31.75), "31.8 kg");
});
