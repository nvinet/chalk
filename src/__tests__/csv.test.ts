/**
 * The CSV export (#30). Pure, so it is tested rather than eyeballed.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { csvFilename, toCsv, CSV_COLUMNS } from "../domain/csv.ts";
import type { Catalogue, Exercise, Session, SetEntry } from "../domain/types.ts";

const bench: Exercise = {
  id: "bench",
  name: "Bench press",
  aliases: [],
  tracking: "weightReps",
  weightIncrementKg: 2.5,
  defaultRestSeconds: 90,
  minimumSets: 3,
};

const catalogue: Pick<Catalogue, "exercises"> = { exercises: [bench] };
const names = {
  families: new Map([["push", "Push"]]),
  muscleGroups: new Map([["chest", "Chest"]]),
};

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
    id: "sess1",
    familyId: "push",
    date: "2026-09-01",
    startedAt: "2026-09-01T18:00:00Z",
    status: "finished",
    requirements: [],
    sets,
    ...over,
  };
}

function rows(csv: string): string[] {
  return csv.trimEnd().split("\n");
}

test("the header names every column, and a row carries both exercise and group", () => {
  const csv = toCsv([session([set({ reps: 8, weightKg: 80 })])], catalogue, names);
  const [header, first] = rows(csv);

  assert.equal(header, CSV_COLUMNS.join(","));
  // The pairing is the point: a row naming only the exercise would throw away
  // what makes the numbers exact rather than inferred (D4).
  assert.ok(first?.includes("Chest"));
  assert.ok(first?.includes("Bench press"));
  assert.ok(first?.includes("Push"));
});

test("a name containing a comma survives the round trip", () => {
  const awkward: Exercise = { ...bench, id: "hc", name: 'Hammer curl, "close" grip' };
  const csv = toCsv(
    [session([set({ exerciseId: "hc", reps: 10, weightKg: 20 })])],
    { exercises: [awkward] },
    names,
  );
  // Quoted, with its own quotes doubled — the rule every spreadsheet agrees on.
  assert.ok(csv.includes('"Hammer curl, ""close"" grip"'));
  // And the row still has the right number of fields when split properly.
  assert.equal(rows(csv).length, 2);
});

test("every set is exported, and the file says which ones counted", () => {
  const csv = toCsv(
    [
      session([
        set({ id: "a", reps: 10, weightKg: 20, warmup: true }),
        set({ id: "b", setNumber: 2, reps: 8, weightKg: 80 }),
        set({ id: "c", setNumber: 3, skipped: true }),
      ]),
    ],
    catalogue,
    names,
  );

  const body = rows(csv).slice(1);
  // Nothing is filtered out — a warm-up and a skip are part of what happened.
  assert.equal(body.length, 3);
  // But the reader is told, by the app's own rule rather than a guess.
  assert.ok(body[0]?.endsWith("no,finished"), "a warm-up did not count (D15)");
  assert.ok(body[1]?.endsWith("yes,finished"), "a working set counted");
  assert.ok(body[2]?.endsWith("no,finished"), "a skip did not count");
});

test("an abandoned session is exported and says so", () => {
  const csv = toCsv(
    [session([set({ reps: 8, weightKg: 80 })], { status: "abandoned" })],
    catalogue,
    names,
  );
  assert.ok(rows(csv)[1]?.includes("abandoned"));
});

test("sessions run forwards in time", () => {
  const csv = toCsv(
    [
      session([set({ id: "late", reps: 8, weightKg: 90 })], { id: "s2", date: "2026-09-08" }),
      session([set({ id: "early", reps: 8, weightKg: 80 })], { id: "s1", date: "2026-09-01" }),
    ],
    catalogue,
    names,
  );
  const body = rows(csv).slice(1);
  assert.ok(body[0]?.startsWith("2026-09-01"));
  assert.ok(body[1]?.startsWith("2026-09-08"));
});

test("an empty history is a header and nothing else, not an empty file", () => {
  const csv = toCsv([], catalogue, names);
  assert.equal(csv, `${CSV_COLUMNS.join(",")}\n`);
});

test("the filename carries the date so two exports do not collide", () => {
  assert.equal(csvFilename("2026-09-14"), "chalk-2026-09-14.csv");
});
