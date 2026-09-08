import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  extendRest,
  formatRemaining,
  isFinished,
  isForPairing,
  remainingSeconds,
  restProgress,
  startRest,
} from "../domain/rest.ts";

const pairing = { exerciseId: "bench-press-flat", muscleGroupId: "chest" };
const NOW = 1_757_000_000_000;

describe("the rest timer", () => {
  it("is an end time, so a backgrounded app comes back correct", () => {
    // The whole point: nothing ticked for a minute and the answer is still right.
    const timer = startRest(pairing, 90, NOW)!;
    assert.equal(remainingSeconds(timer, NOW + 60_000), 30);
  });

  it("reads 0 rather than a negative once it has overrun", () => {
    const timer = startRest(pairing, 90, NOW)!;
    assert.equal(remainingSeconds(timer, NOW + 200_000), 0);
    assert.ok(isFinished(timer, NOW + 200_000));
  });

  it("is not finished a moment before it ends", () => {
    const timer = startRest(pairing, 90, NOW)!;
    assert.equal(isFinished(timer, NOW + 89_999), false);
  });

  it("declines to start when the exercise asks for no rest", () => {
    // A run has nothing to rest between. That is an answer, not a gap.
    assert.equal(startRest(pairing, 0, NOW), null);
  });

  it("extends both the end time and the total, so the bar stays honest", () => {
    const timer = extendRest(startRest(pairing, 90, NOW)!, 30);
    assert.equal(timer.totalSeconds, 120);
    assert.equal(remainingSeconds(timer, NOW), 120);
    assert.equal(restProgress(timer, NOW), 0);
  });

  it("reports progress from none to all", () => {
    const timer = startRest(pairing, 90, NOW)!;
    assert.equal(restProgress(timer, NOW), 0);
    assert.equal(restProgress(timer, NOW + 45_000), 0.5);
    assert.equal(restProgress(timer, NOW + 90_000), 1);
    assert.equal(restProgress(timer, NOW + 900_000), 1);
  });

  it("belongs to one pairing, not to an exercise", () => {
    // Bench for chest and bench for shoulders are different histories, and a
    // rest started under one must not appear under the other.
    const timer = startRest(pairing, 90, NOW)!;
    assert.ok(isForPairing(timer, pairing));
    assert.equal(
      isForPairing(timer, { exerciseId: "bench-press-flat", muscleGroupId: "shoulders" }),
      false,
    );
  });
});

describe("formatRemaining", () => {
  it("pads the seconds and not the minutes", () => {
    assert.equal(formatRemaining(72), "1:12");
    assert.equal(formatRemaining(5), "0:05");
    assert.equal(formatRemaining(60), "1:00");
    assert.equal(formatRemaining(0), "0:00");
  });

  it("never shows a negative", () => {
    assert.equal(formatRemaining(-4), "0:00");
  });
});
