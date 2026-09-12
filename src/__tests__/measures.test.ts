/**
 * The rules added by D12 (distance), D14 (bodyweight) and D15 (warm-ups).
 *
 * These use hand-built sessions rather than the spreadsheet fixtures, because
 * none of the historical datan exercises a distance exercise or a warm-up flag —
 * both postdate it.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateSession,
  indexById,
  isSetLogged,
} from "../domain/completion.ts";
import {
  bestsForPairing,
  formatWeightReps,
  lastTimeForPairing,
  personalBestsInSession,
  setVolumeKg,
  topSetSeries,
} from "../domain/scoring.ts";
import { isWeightBased } from "../domain/types.ts";
import type { Exercise, Session, SetEntry } from "../domain/types.ts";

const lift: Exercise = {
  id: "bench",
  name: "Bench",
  aliases: [],
  tracking: "weightReps",
  weightIncrementKg: 2.5,
  defaultRestSeconds: 90,
  minimumSets: 3,
};
const rower: Exercise = { ...lift, id: "rower", name: "Rower", tracking: "duration" };
const jog: Exercise = { ...lift, id: "jog", name: "Jogging", tracking: "distance" };

function set(over: Partial<SetEntry> = {}): SetEntry {
  return {
    id: "s1",
    exerciseId: "bench",
    muscleGroupId: "chest",
    setNumber: 1,
    completed: true,
    skipped: false,
    ...over,
  };
}

function session(sets: SetEntry[], over: Partial<Session> = {}): Session {
  return {
    id: "sess",
    familyId: "push",
    date: "2026-09-07",
    startedAt: "2026-09-07T09:00:00Z",
    status: "finished",
    requirements: [{ muscleGroupId: "chest", requiredExerciseCount: 1 }],
    sets,
    ...over,
  };
}

// --------------------------------------------------------------- D12 distance

test("a distance exercise is logged on distance alone", () => {
  assert.equal(isSetLogged(set({ exerciseId: "jog", distanceM: 5000 }), "distance"), true);
});

test("a distance exercise with no distance is not logged", () => {
  assert.equal(isSetLogged(set({ exerciseId: "jog", durationSeconds: 1800 }), "distance"), false);
});

test("distance counts a muscle group as met", () => {
  const s = session([set({ exerciseId: "jog", muscleGroupId: "chest", distanceM: 5000 })]);
  assert.equal(evaluateSession(s, { exercises: [jog] }).successful, true);
});

test("isWeightBased is true only for weightReps", () => {
  assert.equal(isWeightBased("weightReps"), true);
  assert.equal(isWeightBased("duration"), false);
  assert.equal(isWeightBased("distance"), false);
});

// The regression D12 warned about: `tracking === "duration"` treated distance
// as a weights exercise, so cardio produced 0 kg bests and flat charts.

test("a distance exercise records no personal best of 0 kg", () => {
  const s = session([set({ exerciseId: "jog", distanceM: 5000 })]);
  assert.deepEqual(personalBestsInSession(s, [], { exercises: [jog] }), []);
});

test("a distance exercise has no heaviest weight", () => {
  const s = session([set({ exerciseId: "jog", distanceM: 5000 })]);
  const best = bestsForPairing([s], { exerciseId: "jog", muscleGroupId: "chest" }, jog);
  assert.equal(best.heaviestKg, null);
});

test("a distance exercise charts nothing rather than a line of zeroes", () => {
  const s = session([set({ exerciseId: "jog", distanceM: 5000 })]);
  assert.deepEqual(topSetSeries([s], { exerciseId: "jog", muscleGroupId: "chest" }, jog), []);
});

test("last time on a distance exercise reads in km, not kg", () => {
  const s = session([set({ exerciseId: "jog", distanceM: 5000 })]);
  const last = lastTimeForPairing([s], { exerciseId: "jog", muscleGroupId: "chest" }, jog);
  assert.equal(last?.summary, "5 km");
});

test("last time on a timed exercise still reads in minutes", () => {
  const s = session([set({ exerciseId: "rower", durationSeconds: 1800 })]);
  const last = lastTimeForPairing([s], { exerciseId: "rower", muscleGroupId: "chest" }, rower);
  assert.equal(last?.summary, "30 min");
});

test("a distance exercise contributes no volume", () => {
  assert.equal(setVolumeKg(set({ exerciseId: "jog", distanceM: 5000 }), jog), 0);
});

// ------------------------------------------------------------ D14 bodyweight

test("a weight of 0 is still accepted, because logging is never blocked", () => {
  assert.equal(isSetLogged(set({ reps: 10, weightKg: 0 }), "weightReps"), true);
});

test("0 reps is not accepted, whatever the weight", () => {
  assert.equal(isSetLogged(set({ reps: 0, weightKg: 80 }), "weightReps"), false);
});

test("a bodyweight entered as a real load behaves like any other weight", () => {
  const s = session([set({ reps: 10, weightKg: 82.5 })]);
  const best = bestsForPairing([s], { exerciseId: "bench", muscleGroupId: "chest" }, lift);
  assert.equal(best.heaviestKg, 82.5);
});

// -------------------------------------------------------------- D15 warm-ups

test("a warm-up set does not count as logged", () => {
  assert.equal(isSetLogged(set({ reps: 10, weightKg: 20, warmup: true }), "weightReps"), false);
});

test("a warm-up alone never completes a muscle group", () => {
  const s = session([set({ reps: 10, weightKg: 20, warmup: true })]);
  const outcome = evaluateSession(s, { exercises: [lift] });
  assert.equal(outcome.successful, false);
  assert.equal(outcome.groups[0]?.loggedCount, 0);
});

test("a warm-up contributes no volume", () => {
  assert.equal(setVolumeKg(set({ reps: 10, weightKg: 20, warmup: true }), lift), 0);
});

test("a warm-up cannot set a personal best", () => {
  const s = session([set({ reps: 1, weightKg: 500, warmup: true })]);
  assert.deepEqual(personalBestsInSession(s, [], { exercises: [lift] }), []);
});

test("a working set alongside a warm-up still counts", () => {
  const s = session([
    set({ id: "w", reps: 10, weightKg: 20, warmup: true }),
    // Three working sets, because the warm-up contributes none of them (D23).
    set({ id: "x", setNumber: 2, reps: 8, weightKg: 80 }),
    set({ id: "y", setNumber: 3, reps: 8, weightKg: 80 }),
    set({ id: "z", setNumber: 4, reps: 8, weightKg: 80 }),
  ]);
  const outcome = evaluateSession(s, { exercises: [lift] });
  assert.equal(outcome.successful, true);
  assert.equal(outcome.groups[0]?.loggedCount, 1);
});

test("indexById still round-trips exercises", () => {
  assert.equal(indexById([lift, jog]).get("jog")?.tracking, "distance");
});

// ------------------------------------------------- the personal best (#67)

const pairing = { exerciseId: "bench", muscleGroupId: "chest" };

test("the heaviest set wins, and carries its reps and its date", () => {
  const best = bestsForPairing(
    [
      session([set({ id: "a", reps: 10, weightKg: 60 })], { id: "s1", date: "2026-08-01" }),
      session([set({ id: "b", reps: 5, weightKg: 80 })], { id: "s2", date: "2026-08-08" }),
      session([set({ id: "c", reps: 12, weightKg: 70 })], { id: "s3", date: "2026-08-15" }),
    ],
    pairing,
    lift,
  );
  assert.equal(best.heaviestKg, 80);
  assert.equal(best.heaviestReps, 5);
  assert.equal(best.heaviestOn, "2026-08-08");
});

test("at the same weight, more reps is the better set", () => {
  const best = bestsForPairing(
    [
      session([set({ id: "a", reps: 5, weightKg: 80 })], { id: "s1", date: "2026-08-01" }),
      session([set({ id: "b", reps: 9, weightKg: 80 })], { id: "s2", date: "2026-08-08" }),
      session([set({ id: "c", reps: 7, weightKg: 80 })], { id: "s3", date: "2026-08-15" }),
    ],
    pairing,
    lift,
  );
  assert.equal(best.heaviestKg, 80);
  assert.equal(best.heaviestReps, 9);
  assert.equal(best.heaviestOn, "2026-08-08");
});

test("a lighter set with more reps does not displace a heavier one", () => {
  const best = bestsForPairing(
    [
      session([set({ id: "a", reps: 3, weightKg: 100 })], { id: "s1", date: "2026-08-01" }),
      session([set({ id: "b", reps: 20, weightKg: 40 })], { id: "s2", date: "2026-08-08" }),
    ],
    pairing,
    lift,
  );
  assert.equal(best.heaviestKg, 100);
  assert.equal(best.heaviestReps, 3);
});

test("a warm-up is never a personal best", () => {
  const best = bestsForPairing(
    [session([set({ id: "w", reps: 3, weightKg: 200, warmup: true })])],
    pairing,
    lift,
  );
  assert.equal(best.heaviestKg, null);
  assert.equal(best.heaviestReps, null);
  assert.equal(best.heaviestOn, null);
});

test("a timed exercise has no weight best to show", () => {
  const best = bestsForPairing(
    [session([set({ id: "r", exerciseId: "rower", durationSeconds: 900 })])],
    { exerciseId: "rower", muscleGroupId: "chest" },
    rower,
  );
  assert.equal(best.heaviestKg, null);
});

// ------------------------------------- last and best read the same way (#67)

test("last is written in the same shape as best", () => {
  const history = [
    session([set({ id: "a", reps: 8, weightKg: 82.5 })], { id: "s1", date: "2026-09-08" }),
  ];

  const last = lastTimeForPairing(history, pairing, lift);
  const best = bestsForPairing(history, pairing, lift);

  assert.equal(last?.measure, "82.5 kg × 8");
  assert.equal(formatWeightReps(best.heaviestKg!, best.heaviestReps), "82.5 kg × 8");
  // The same set, described identically by both — which is the point.
  assert.equal(last?.measure, formatWeightReps(best.heaviestKg!, best.heaviestReps));
});

test("the measure is the top set, by the rule a best uses", () => {
  const last = lastTimeForPairing(
    [
      session(
        [
          set({ id: "a", reps: 12, weightKg: 70 }),
          set({ id: "b", setNumber: 2, reps: 6, weightKg: 82.5 }),
          set({ id: "c", setNumber: 3, reps: 8, weightKg: 82.5 }),
        ],
        { id: "s1", date: "2026-09-08" },
      ),
    ],
    pairing,
    lift,
  );

  // Heaviest wins over more reps at a lighter load; at equal load, more reps.
  assert.equal(last?.topSetWeightKg, 82.5);
  assert.equal(last?.topSetReps, 8);
  assert.equal(last?.measure, "82.5 kg × 8");
});

test("summary still describes the whole visit, for lists that want that", () => {
  const last = lastTimeForPairing(
    [
      session(
        [
          set({ id: "a", reps: 8, weightKg: 82.5 }),
          set({ id: "b", setNumber: 2, reps: 6, weightKg: 82.5 }),
        ],
        { id: "s1", date: "2026-09-08" },
      ),
    ],
    pairing,
    lift,
  );
  assert.equal(last?.measure, "82.5 kg × 8");
  assert.match(last?.summary ?? "", /2 sets/);
});

test("timed and distance carry a measure too, with no reps to show", () => {
  const timed = lastTimeForPairing(
    [session([set({ id: "r", exerciseId: "rower", durationSeconds: 900 })])],
    { exerciseId: "rower", muscleGroupId: "chest" },
    rower,
  );
  assert.equal(timed?.measure, "15 min");
  assert.equal(timed?.topSetReps, null);
});

test("formatWeightReps drops the reps when there are none", () => {
  assert.equal(formatWeightReps(60, 10), "60 kg × 10");
  assert.equal(formatWeightReps(60, null), "60 kg");
  assert.equal(formatWeightReps(60, 0), "60 kg");
});
