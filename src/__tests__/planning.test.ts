/** What to train today, derived from history alone (#32). */

import test from "node:test";
import assert from "node:assert/strict";

import {
  countsByFamily,
  lastSessionByFamily,
  planStreak,
  sessionsInWeek,
  sessionsThisWeek,
  shiftWeek,
  startOfWeek,
  suggestFamily,
  weekAdherence,
  weekDates,
  weekMetPlan,
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

// ---------------------------------------------------------- abandoned (#59)

function abandoned(familyId: string, date: string): Session {
  return { ...session(familyId, date), status: "abandoned" };
}

test("an abandoned session does not count as training this week", () => {
  const week = sessionsThisWeek([abandoned("push", "2026-09-08")], "2026-09-08");
  assert.deepEqual(week, []);
});

test("an abandoned session does not mark a family as recently trained", () => {
  // The whole point of abandoning: it must not push that family down the order.
  const sessions = [
    session("push", "2026-09-01"),
    abandoned("pull", "2026-09-08"),
    session("legs", "2026-09-02"),
  ];
  assert.equal(suggestFamily(families, sessions)?.id, "pull");
});

test("an in-progress session still counts — it is happening", () => {
  const live: Session = { ...session("push", "2026-09-08"), status: "inProgress" };
  assert.equal(sessionsThisWeek([live], "2026-09-08").length, 1);
});

test("last done ignores an abandoned session in favour of a real one", () => {
  const latest = lastSessionByFamily([
    session("push", "2026-09-01"),
    abandoned("push", "2026-09-08"),
  ]);
  assert.equal(latest.get("push")?.date, "2026-09-01");
});

// ------------------------------------------ the weekly plan and adherence (#33)

test("a week runs Monday to Sunday and shifts both ways", () => {
  const monday = startOfWeek("2026-09-10"); // a Thursday
  assert.equal(monday, "2026-09-07");
  assert.deepEqual(weekDates(monday), [
    "2026-09-07",
    "2026-09-08",
    "2026-09-09",
    "2026-09-10",
    "2026-09-11",
    "2026-09-12",
    "2026-09-13",
  ]);
  assert.equal(shiftWeek(monday, -1), "2026-08-31");
  assert.equal(shiftWeek(monday, 1), "2026-09-14");
});

test("a target is derived from the days given to a family, not stored", () => {
  const push = { id: "push", name: "Push", position: 1, usesMuscleGroups: true };
  const pull = { id: "pull", name: "Pull", position: 2, usesMuscleGroups: true };
  // Push twice a week, pull once, the rest are rest days.
  const schedule = new Map<number, string | null>([
    [0, "push"],
    [1, null],
    [2, "pull"],
    [3, "push"],
    [4, null],
    [5, null],
    [6, null],
  ]);

  const rows = weekAdherence([push, pull], schedule, [], new Set());
  assert.equal(rows.find((r) => r.familyId === "push")?.target, 2);
  assert.equal(rows.find((r) => r.familyId === "pull")?.target, 1);
});

test("attendance and success are counted separately (C3)", () => {
  const push = { id: "push", name: "Push", position: 1, usesMuscleGroups: true };
  const schedule = new Map<number, string | null>([[0, "push"], [3, "push"]]);

  const attended = [
    { ...sessionOn("push", "2026-09-07"), id: "good" },
    { ...sessionOn("push", "2026-09-10"), id: "poor" },
  ];

  // Both turned up; only one met its groups.
  const rows = weekAdherence([push], schedule, attended, new Set(["good"]));
  const row = rows[0];
  assert.equal(row?.target, 2);
  assert.equal(row?.attended, 2);
  assert.equal(row?.successful, 1);
});

test("a family neither planned nor trained is not a row", () => {
  const push = { id: "push", name: "Push", position: 1, usesMuscleGroups: true };
  const legs = { id: "legs", name: "Legs", position: 3, usesMuscleGroups: true };
  const schedule = new Map<number, string | null>([[0, "push"]]);

  const rows = weekAdherence([push, legs], schedule, [], new Set());
  assert.deepEqual(rows.map((r) => r.familyId), ["push"]);
});

test("an unplanned session still shows, so the week is not a lie", () => {
  const legs = { id: "legs", name: "Legs", position: 3, usesMuscleGroups: true };
  const rows = weekAdherence(
    [legs],
    new Map<number, string | null>(),
    [sessionOn("legs", "2026-09-09")],
    new Set(),
  );
  assert.equal(rows[0]?.target, 0);
  assert.equal(rows[0]?.attended, 1);
});

test("only the sessions of that week are counted", () => {
  const all = [
    sessionOn("push", "2026-09-06"), // the Sunday before
    sessionOn("push", "2026-09-07"), // Monday
    sessionOn("push", "2026-09-13"), // Sunday
    sessionOn("push", "2026-09-14"), // the Monday after
  ];
  const inWeek = sessionsInWeek(all, "2026-09-07");
  assert.deepEqual(inWeek.map((s) => s.date), ["2026-09-07", "2026-09-13"]);
});

function sessionOn(familyId: string, date: string): Session {
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

// -------------------------------------- weeks meeting the plan, and runs (#35)

test("a week with no plan does not count as followed", () => {
  // Nothing planned, nothing trained: there was nothing to follow.
  assert.equal(weekMetPlan([]), false);
  // Trained, but against no plan — still not "followed the plan".
  assert.equal(
    weekMetPlan([{ familyId: "legs", target: 0, attended: 2, successful: 2 }]),
    false,
  );
});

test("following the plan is attendance, not success (C3)", () => {
  // Turned up both planned days; met neither. The plan was still followed.
  assert.equal(
    weekMetPlan([{ familyId: "push", target: 2, attended: 2, successful: 0 }]),
    true,
  );
});

test("every planned family has to reach its own target", () => {
  const rows = [
    { familyId: "push", target: 2, attended: 2, successful: 2 },
    { familyId: "pull", target: 1, attended: 0, successful: 0 },
  ];
  assert.equal(weekMetPlan(rows), false);
});

test("an unplanned extra does not break a followed week", () => {
  const rows = [
    { familyId: "push", target: 2, attended: 2, successful: 2 },
    { familyId: "legs", target: 0, attended: 1, successful: 0 },
  ];
  assert.equal(weekMetPlan(rows), true);
});

test("a streak counts back from the most recent week and stops at the first miss", () => {
  // Oldest first, as the week list is built.
  assert.equal(planStreak([true, false, true, true, true]), 3);
  assert.equal(planStreak([true, true, false]), 0);
  assert.equal(planStreak([]), 0);
  assert.equal(planStreak([true]), 1);
});
