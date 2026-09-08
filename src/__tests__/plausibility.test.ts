import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { MeasureValues } from "../domain/measures.ts";
import {
  checkMeasures,
  referenceValues,
  withoutLastDigit,
} from "../domain/plausibility.ts";
import type { SetEntry } from "../domain/types.ts";

function values(overrides: Partial<MeasureValues> = {}): MeasureValues {
  return { reps: 10, weightKg: 40, minutes: 20, km: 5, ...overrides };
}

function set(overrides: Partial<SetEntry>): SetEntry {
  return {
    id: "set-1",
    sessionId: "session-1",
    exerciseId: "hack-squat",
    muscleGroupId: "quads",
    setNumber: 1,
    ...overrides,
  } as SetEntry;
}

describe("warning on implausible values", () => {
  it("catches the spreadsheet's 408 kg and suggests the 40", () => {
    const [warning, ...rest] = checkMeasures("weightReps", values({ weightKg: 408 }));
    assert.equal(rest.length, 0);
    assert.equal(warning?.key, "weightKg");
    assert.equal(warning?.message, "408 kg — did you mean 40?");
  });

  it("says nothing about a weight anyone could actually lift", () => {
    assert.deepEqual(checkMeasures("weightReps", values({ weightKg: 100 })), []);
  });

  it("catches a stray digit against his own history, well under the ceiling", () => {
    // 12 kg curl typed as 120: nowhere near absurd on its own.
    const warnings = checkMeasures("weightReps", values({ weightKg: 120 }), { weightKg: 12 });
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0]?.message, "120 kg — did you mean 12?");
  });

  it("allows honest progress against history", () => {
    // Adding 2.5 kg to a 40 kg lift is a session, not a slip.
    assert.deepEqual(checkMeasures("weightReps", values({ weightKg: 42.5 }), { weightKg: 40 }), []);
  });

  it("applies no relative rule the first time an exercise is logged", () => {
    // Nothing to compare against, so guessing would only be noise.
    assert.deepEqual(checkMeasures("weightReps", values({ weightKg: 90 })), []);
  });

  it("names last time when dropping a digit still leaves something absurd", () => {
    // 1 km last time, 40 typed: 4 is no more believable than 40, so there is
    // nothing useful to suggest and the warning just states the comparison.
    const warnings = checkMeasures("distance", values({ km: 40 }), { km: 1 });
    assert.equal(warnings[0]?.message, "40 km — last time was 1 km.");
  });

  it("calls a value a slip when even the shortened one is impossible", () => {
    const warnings = checkMeasures("weightReps", values({ weightKg: 4000 }));
    assert.equal(warnings[0]?.message, "4000 kg — that looks like a slip.");
  });

  it("warns on a weight of 0, because bodyweight is entered as a load (D14)", () => {
    const warnings = checkMeasures("weightReps", values({ weightKg: 0 }));
    assert.equal(warnings.length, 1);
    assert.match(warnings[0]?.message ?? "", /^0 kg — bodyweight still counts as a load/);
  });

  it("warns on 0 reps", () => {
    const warnings = checkMeasures("weightReps", values({ reps: 0 }));
    assert.equal(warnings[0]?.key, "reps");
  });

  it("warns once per control, not once per rule", () => {
    // Both wrong at once: two sentences, one for each stepper.
    const warnings = checkMeasures("weightReps", values({ reps: 0, weightKg: 408 }));
    assert.deepEqual(
      warnings.map((w) => w.key),
      ["reps", "weightKg"],
    );
  });

  it("only checks the measures the exercise actually records", () => {
    // A run asks for kilometres, so an absurd weight sitting in the draft is
    // not its business (D12).
    assert.deepEqual(checkMeasures("distance", values({ weightKg: 408, km: 5 })), []);
  });

  it("catches 50 km typed for a 5 km run", () => {
    const warnings = checkMeasures("distance", values({ km: 50 }), { km: 5 });
    assert.equal(warnings[0]?.message, "50 km — did you mean 5?");
  });

  it("catches an absurd duration with no history at all", () => {
    const warnings = checkMeasures("duration", values({ minutes: 480 }));
    assert.equal(warnings[0]?.message, "480 min — did you mean 48?");
  });
});

describe("withoutLastDigit", () => {
  it("drops the digit that was probably doubled", () => {
    assert.equal(withoutLastDigit(408), 40);
    assert.equal(withoutLastDigit(600), 60);
  });

  it("gives up below ten, where there is nothing to drop", () => {
    assert.equal(withoutLastDigit(8), null);
  });
});

describe("referenceValues", () => {
  it("takes his best of each measure, in the units the controls hold", () => {
    const reference = referenceValues([
      set({ reps: 8, weightKg: 40 }),
      set({ reps: 12, weightKg: 35 }),
      set({ durationSeconds: 1800, distanceM: 5000 }),
    ]);
    assert.equal(reference.reps, 12);
    assert.equal(reference.weightKg, 40);
    assert.equal(reference.minutes, 30);
    assert.equal(reference.km, 5);
  });

  it("is zero throughout when there is no history", () => {
    assert.deepEqual(referenceValues([]), { reps: 0, weightKg: 0, minutes: 0, km: 0 });
  });
});
