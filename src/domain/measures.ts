/**
 * What an exercise asks for, and how those numbers become a set.
 *
 * Pure, and here rather than in the screen because the conversions are a
 * domain rule: weight is stored in kilograms and distance in metres (G1, D12),
 * whatever the controls happen to show. A unit bug in this file would corrupt
 * a history silently and for good, which is the reason it is testable at all.
 */

import type { SetEntry, TrackingType } from "./types.ts";

export type MeasureKey = "reps" | "weightKg" | "minutes" | "km";

export interface MeasureField {
  key: MeasureKey;
  label: string;
  /** How much one press of + or − moves it. */
  step: number;
  decimals: number;
}

/** The values the controls hold. Display units, not storage units. */
export type MeasureValues = Record<MeasureKey, number>;

/**
 * Which controls an exercise needs. One measure per exercise (D12), so a run
 * asks for kilometres and never for a weight.
 */
export function fieldsForTracking(
  tracking: TrackingType,
  weightIncrementKg: number,
): MeasureField[] {
  switch (tracking) {
    case "duration":
      return [{ key: "minutes", label: "minutes", step: 1, decimals: 0 }];
    case "distance":
      return [{ key: "km", label: "kilometres", step: 0.5, decimals: 1 }];
    case "weightReps":
      return [
        { key: "reps", label: "reps", step: 1, decimals: 0 },
        { key: "weightKg", label: "weight (kg)", step: weightIncrementKg, decimals: 1 },
      ];
  }
}

/** Display units in, storage units out. */
export function toSetInput(tracking: TrackingType, values: MeasureValues) {
  switch (tracking) {
    case "duration":
      return { durationSeconds: Math.round(values.minutes * 60) };
    case "distance":
      return { distanceM: Math.round(values.km * 1000) };
    case "weightReps":
      return { reps: Math.round(values.reps), weightKg: values.weightKg };
  }
}

/**
 * Starting values for the next set: repeat the last one of this session, else
 * what was done last time, else a plausible opening. Repeating a set is then a
 * single tap (N4).
 */
export function prefillValues(
  thisSession: SetEntry[],
  lastTime: SetEntry[],
): MeasureValues {
  const source = thisSession.at(-1) ?? lastTime.at(-1);
  return {
    reps: source?.reps ?? 10,
    weightKg: source?.weightKg ?? 20,
    minutes: source?.durationSeconds ? Math.round(source.durationSeconds / 60) : 20,
    km: source?.distanceM ? source.distanceM / 1000 : 5,
  };
}

/** One logged set, in the units it was recorded in. */
export function describeSet(set: SetEntry, tracking: TrackingType): string {
  switch (tracking) {
    case "duration":
      return `${Math.round((set.durationSeconds ?? 0) / 60)} min`;
    case "distance":
      return `${trimDecimal((set.distanceM ?? 0) / 1000)} km`;
    case "weightReps":
      return `${set.reps ?? 0} × ${trimDecimal(set.weightKg ?? 0)} kg`;
  }
}

/** Rounds to the step's precision, so 2.5 increments never drift. */
export function stepBy(value: number, step: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.max(0, Math.round((value + step) * factor) / factor);
}

export function trimDecimal(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
