/** Row ids and the local date used to group sessions (#19). */

import test from "node:test";
import assert from "node:assert/strict";

import { newId, today } from "../db/ids.ts";

test("an id carries its prefix and is unique across a burst", () => {
  const ids = new Set(Array.from({ length: 1000 }, () => newId("session")));
  assert.equal(ids.size, 1000);
  for (const id of ids) assert.ok(id.startsWith("session-"), id);
});

test("ids sort in creation order", () => {
  // Time first, so a database dump reads chronologically and "the set entered
  // last" is answerable without a timestamp.
  const early = newId("set");
  const later = `set-${(Date.now() + 60_000).toString(36)}-zzzzzz`;
  assert.ok(early < later);
});

test("today is the local calendar date, zero padded", () => {
  assert.equal(today(new Date(2026, 0, 5)), "2026-01-05");
  assert.equal(today(new Date(2026, 11, 31)), "2026-12-31");
});

test("today uses local time, not UTC", () => {
  // A session logged at 23:00 belongs to that day, whatever UTC thinks. Using
  // toISOString here would roll the date forward for anyone east of Greenwich.
  const lateEvening = new Date(2026, 8, 8, 23, 30);
  assert.equal(today(lateEvening), "2026-09-08");
});
