/**
 * Turning what the controls show into what gets stored (#22).
 *
 * These are the conversions that would corrupt a history silently: nothing
 * complains if a 5 km run is filed as 5 metres, it just quietly makes every
 * later chart wrong.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  describeSet,
  fieldsForTracking,
  prefillValues,
  stepBy,
  toSetInput,
  trimDecimal,
} from "../domain/measures.ts";
import type { SetEntry } from "../domain/types.ts";

function set(over: Partial<SetEntry> = {}): SetEntry {
  return {
    id: "s",
    exerciseId: "e",
    muscleGroupId: "g",
    setNumber: 1,
    completed: true,
    skipped: false,
    ...over,
  };
}

const base = { reps: 0, weightKg: 0, minutes: 0, km: 0 };

// ------------------------------------------------------------------ fields

test("each tracking type asks for its own measure and nothing else", () => {
  assert.deepEqual(
    fieldsForTracking("weightReps", 2.5).map((f) => f.key),
    ["reps", "weightKg"],
  );
  assert.deepEqual(fieldsForTracking("duration", 2.5).map((f) => f.key), ["minutes"]);
  assert.deepEqual(fieldsForTracking("distance", 2.5).map((f) => f.key), ["km"]);
});

test("the weight step comes from the exercise, not a constant", () => {
  // A lateral raise moves in 1 kg, a bench press in 2.5.
  const [, weight] = fieldsForTracking("weightReps", 1);
  assert.equal(weight?.step, 1);
});

// -------------------------------------------------------------- conversion

test("kilometres are stored as metres", () => {
  assert.deepEqual(toSetInput("distance", { ...base, km: 5 }), { distanceM: 5000 });
  assert.deepEqual(toSetInput("distance", { ...base, km: 2.5 }), { distanceM: 2500 });
});

test("minutes are stored as seconds", () => {
  assert.deepEqual(toSetInput("duration", { ...base, minutes: 30 }), {
    durationSeconds: 1800,
  });
});

test("weight is stored as entered, and reps are whole", () => {
  assert.deepEqual(toSetInput("weightReps", { ...base, reps: 10.4, weightKg: 82.5 }), {
    reps: 10,
    weightKg: 82.5,
  });
});

test("a weightReps set never carries a duration or a distance", () => {
  // The wrong shape here would count a lift as cardio in the completion rule.
  const input = toSetInput("weightReps", { ...base, reps: 8, weightKg: 60 });
  assert.equal("durationSeconds" in input, false);
  assert.equal("distanceM" in input, false);
});

// ----------------------------------------------------------------- prefill

test("the next set repeats the last one of this session", () => {
  const values = prefillValues([set({ reps: 8, weightKg: 60 })], []);
  assert.equal(values.reps, 8);
  assert.equal(values.weightKg, 60);
});

test("with nothing logged yet, it falls back to last time", () => {
  const values = prefillValues([], [set({ reps: 12, weightKg: 70 })]);
  assert.equal(values.reps, 12);
  assert.equal(values.weightKg, 70);
});

test("this session wins over last time", () => {
  const values = prefillValues([set({ reps: 6, weightKg: 90 })], [set({ reps: 12, weightKg: 70 })]);
  assert.equal(values.weightKg, 90);
});

test("a first ever set opens on something plausible, not zero", () => {
  // Zero reps would not even count as logged (D5).
  const values = prefillValues([], []);
  assert.ok(values.reps > 0);
  assert.ok(values.km > 0);
  assert.ok(values.minutes > 0);
});

test("prefill round-trips storage units back to display units", () => {
  const values = prefillValues([set({ distanceM: 7500, durationSeconds: 2700 })], []);
  assert.equal(values.km, 7.5);
  assert.equal(values.minutes, 45);
});

// ------------------------------------------------------------------- steps

test("stepping by 2.5 does not drift", () => {
  let v = 0;
  for (let i = 0; i < 10; i++) v = stepBy(v, 2.5, 1);
  assert.equal(v, 25);
});

test("stepping never goes below zero", () => {
  assert.equal(stepBy(1, -2.5, 1), 0);
});

// ----------------------------------------------------------------- display

test("a set reads in the units it was recorded in", () => {
  assert.equal(describeSet(set({ reps: 10, weightKg: 75 }), "weightReps"), "75 kg × 10");
  assert.equal(describeSet(set({ durationSeconds: 1800 }), "duration"), "30 min");
  assert.equal(describeSet(set({ distanceM: 5000 }), "distance"), "5 km");
  assert.equal(describeSet(set({ distanceM: 7500 }), "distance"), "7.5 km");
});

test("a bodyweight set shows its real load, and 0 still shows", () => {
  assert.equal(describeSet(set({ reps: 10, weightKg: 82.5 }), "weightReps"), "82.5 kg × 10");
  assert.equal(describeSet(set({ reps: 10, weightKg: 0 }), "weightReps"), "0 kg × 10");
});

test("trailing zeroes are trimmed but real decimals are not", () => {
  assert.equal(trimDecimal(75), "75");
  assert.equal(trimDecimal(32.5), "32.5");
});
