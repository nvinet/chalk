/** What to train today, derived from history alone (#32). */

import test from "node:test";
import assert from "node:assert/strict";

import {
  countsByFamily,
  lastSessionByFamily,
  sessionsThisWeek,
  startOfWeek,
  suggestFamily,
} from "../domain/planning.ts";
import type { Family, Session } from "../domain/types.ts";

const families: Family[] = [
  { id: "push", name: "Push", position: 1, usesMuscleGroups: true },
  { id: "pull", name: "Pull", position: 2, usesMuscleGroups: true },
  { id: "legs", name: "Legs", position: 3, usesMuscleGroups: true },
];

function session(familyId: string, date: string): Session {
  return {
    id: `${familyId}-${date}`,
    familyId,
    date,
    startedAt: `${date}T18:00:00Z`,
    status: "finished",
    requirements: [],
    sets: [],
  };
}

// ------------------------------------------------------------------- weeks

test("the week starts on Monday", () => {
  // 2026-09-08 is a Tuesday.
  assert.equal(startOfWeek("2026-09-08"), "2026-09-07");
  assert.equal(startOfWeek("2026-09-07"), "2026-09-07");
});

test("Sunday belongs to the week that is ending, not the one starting", () => {
  // 2026-09-13 is a Sunday; its Monday is the 7th, not the 14th.
  assert.equal(startOfWeek("2026-09-13"), "2026-09-07");
});

test("this week excludes last week and the future", () => {
  const all = [
    session("push", "2026-09-06"), // previous week
    session("pull", "2026-09-07"), // Monday
    session("legs", "2026-09-08"), // today
    session("push", "2026-09-09"), // tomorrow
  ];
  const week = sessionsThisWeek(all, "2026-09-08").map((s) => s.familyId);
  assert.deepEqual(week, ["legs", "pull"]);
});

// ------------------------------------------------------------------ counts

test("a family with no sessions this week counts zero rather than vanishing", () => {
  const counts = countsByFamily(families, [session("push", "2026-09-08")]);
  assert.equal(counts.get("push"), 1);
  assert.equal(counts.get("pull"), 0);
  assert.equal(counts.get("legs"), 0);
});

test("counts ignore a family that is not in the catalogue", () => {
  const counts = countsByFamily(families, [session("cardio", "2026-09-08")]);
  assert.equal(counts.has("cardio"), false);
});

// -------------------------------------------------------------- last done

test("last done is the most recent, whatever order they arrive in", () => {
  const latest = lastSessionByFamily([
    session("push", "2026-09-01"),
    session("push", "2026-09-05"),
    session("push", "2026-09-03"),
  ]);
  assert.equal(latest.get("push")?.date, "2026-09-05");
});

// ------------------------------------------------------------- suggestion

test("suggests the family left longest", () => {
  const sessions = [
    session("push", "2026-09-07"),
    session("pull", "2026-09-02"),
    session("legs", "2026-09-05"),
  ];
  assert.equal(suggestFamily(families, sessions)?.id, "pull");
});

test("a family never trained wins outright", () => {
  // It has been waiting since the beginning, so it beats any real date.
  const sessions = [session("push", "2020-01-01"), session("pull", "2026-09-07")];
  assert.equal(suggestFamily(families, sessions)?.id, "legs");
});

test("with no history at all, it falls back to display order", () => {
  assert.equal(suggestFamily(families, [])?.id, "push");
});

test("ties break on display order, so the answer is stable", () => {
  const sessions = [
    session("push", "2026-09-05"),
    session("pull", "2026-09-05"),
    session("legs", "2026-09-05"),
  ];
  assert.equal(suggestFamily(families, sessions)?.id, "push");
});

test("no families means no suggestion rather than a crash", () => {
  assert.equal(suggestFamily([], []), null);
});
