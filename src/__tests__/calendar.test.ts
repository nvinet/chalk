/** Month grids for the history calendar (#36). */

import test from "node:test";
import assert from "node:assert/strict";

import {
  daysInMonth,
  familyInitials,
  monthGrid,
  monthOf,
  shiftMonth,
} from "../domain/calendar.ts";

test("a month is read off an ISO date", () => {
  assert.deepEqual(monthOf("2026-09-08"), { year: 2026, month: 9 });
});

test("every week has exactly seven cells", () => {
  for (const month of [1, 2, 6, 9, 12]) {
    for (const week of monthGrid({ year: 2026, month })) {
      assert.equal(week.length, 7, `month ${month}`);
    }
  }
});

test("the grid starts on Monday, padding the days before the 1st", () => {
  // 1 September 2026 is a Tuesday, so Monday is blank.
  const [first] = monthGrid({ year: 2026, month: 9 });
  assert.equal(first?.[0], null);
  assert.equal(first?.[1], "2026-09-01");
});

test("a month starting on Monday has no leading blank", () => {
  // 1 June 2026 is a Monday.
  const [first] = monthGrid({ year: 2026, month: 6 });
  assert.equal(first?.[0], "2026-06-01");
});

test("every day of the month appears exactly once", () => {
  const month = { year: 2026, month: 9 };
  const days = monthGrid(month).flat().filter((d) => d !== null);
  assert.equal(days.length, daysInMonth(month));
  assert.equal(new Set(days).size, days.length);
});

test("February knows about leap years", () => {
  assert.equal(daysInMonth({ year: 2026, month: 2 }), 28);
  assert.equal(daysInMonth({ year: 2028, month: 2 }), 29);
});

test("stepping back from January lands in the previous December", () => {
  assert.deepEqual(shiftMonth({ year: 2026, month: 1 }, -1), { year: 2025, month: 12 });
});

test("stepping forward from December lands in the next January", () => {
  assert.deepEqual(shiftMonth({ year: 2026, month: 12 }, 1), { year: 2027, month: 1 });
});

test("stepping a whole year lands on the same month", () => {
  assert.deepEqual(shiftMonth({ year: 2026, month: 9 }, 12), { year: 2027, month: 9 });
  assert.deepEqual(shiftMonth({ year: 2026, month: 9 }, -12), { year: 2025, month: 9 });
});

// -------------------------------------------------------- badge letters (#36)

const family = (id: string, name: string, position: number) => ({ id, name, position });

test("families that share a first letter get different badges", () => {
  // Push and Pull are the reason this function exists.
  const initials = familyInitials([
    family("push", "Push", 1),
    family("pull", "Pull", 2),
    family("legs", "Legs", 3),
  ]);
  assert.equal(initials.get("push"), "P");
  assert.equal(initials.get("pull"), "U");
  assert.equal(initials.get("legs"), "L");
});

test("every family gets a letter, and no two share one", () => {
  const families = [
    family("push", "Push", 1),
    family("pull", "Pull", 2),
    family("legs", "Legs", 3),
    family("abs", "Abs", 4),
    family("cardio", "Cardio", 5),
  ];
  const letters = [...familyInitials(families).values()];
  assert.equal(letters.length, families.length);
  assert.equal(new Set(letters).size, families.length);
});

test("display order decides who keeps the obvious letter", () => {
  const initials = familyInitials([family("pull", "Pull", 1), family("push", "Push", 2)]);
  assert.equal(initials.get("pull"), "P");
  assert.equal(initials.get("push"), "U");
});

test("a renamed family still gets a letter rather than breaking", () => {
  const initials = familyInitials([
    family("a", "Upper body", 1),
    family("b", "Upper back", 2),
  ]);
  assert.equal(initials.get("a"), "U");
  assert.notEqual(initials.get("b"), "U");
});
