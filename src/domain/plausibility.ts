/**
 * Catching a fat-fingered number without ever refusing it (#26).
 *
 * The motivating case is real: the spreadsheet has a 408 kg lift in it, which
 * is a 40 with a stray 8. It sat there uncorrected because nothing ever
 * questioned it, and it will skew any chart that includes it forever.
 *
 * The rule this file obeys is the one the whole app obeys: **logging is never
 * blocked** (N-rule). Wrong data that can be corrected afterwards beats an
 * argument in the middle of a set. So everything here produces a sentence to
 * show, never a reason to refuse.
 */

import { fieldsForTracking, trimDecimal, type MeasureKey, type MeasureValues } from "./measures.ts";
import type { SetEntry, TrackingType } from "./types.ts";

export interface Warning {
  /** Which control the sentence belongs under. */
  key: MeasureKey;
  message: string;
}

/**
 * Beyond this, a value is worth questioning whatever his history says.
 *
 * Deliberately far above anything he will ever do, because a false alarm on a
 * genuine number is worse than a miss: warnings that cry wolf get dismissed
 * without being read, and then the 408 gets through anyway.
 */
const CEILING: Record<MeasureKey, number> = {
  reps: 100,
  weightKg: 300,
  minutes: 300,
  km: 100,
};

/**
 * A jump this large against his own recent best is a typo, not a session.
 *
 * Three times catches the stray-digit case (60 → 600) while leaving room for
 * the honest ones: coming back to an exercise after months, or a first working
 * set that follows a light warm-up.
 */
const JUMP = 3;

const UNIT: Record<MeasureKey, string> = {
  reps: " reps",
  weightKg: " kg",
  minutes: " min",
  km: " km",
};

/** How a value reads in a sentence: `408 kg`, `12 reps`. */
export function describeValue(key: MeasureKey, value: number): string {
  return `${trimDecimal(value)}${UNIT[key]}`;
}

/**
 * The number that was probably meant, by dropping the digit that was probably
 * doubled: 408 → 40, 600 → 60. Null when there is nothing sensible to suggest.
 */
export function withoutLastDigit(value: number): number | null {
  if (value < 10) return null;
  const dropped = Math.floor(value / 10);
  return dropped >= 1 ? dropped : null;
}

/** His own recent best for each measure, in the units the controls hold. */
export function referenceValues(sets: SetEntry[]): Partial<MeasureValues> {
  const best = (pick: (set: SetEntry) => number | null | undefined) =>
    sets.reduce((max, set) => Math.max(max, pick(set) ?? 0), 0);

  return {
    reps: best((s) => s.reps),
    weightKg: best((s) => s.weightKg),
    minutes: best((s) => (s.durationSeconds ? s.durationSeconds / 60 : 0)),
    km: best((s) => (s.distanceM ? s.distanceM / 1000 : 0)),
  };
}

/**
 * What is worth saying about the values as they stand.
 *
 * `reference` is his own recent history for this pairing, when there is any.
 * Without it only the absolute ceilings apply, which is right: the first time
 * an exercise is logged there is nothing to compare against, and guessing
 * would just be noise.
 */
export function checkMeasures(
  tracking: TrackingType,
  values: MeasureValues,
  reference: Partial<MeasureValues> = {},
): Warning[] {
  const warnings: Warning[] = [];

  for (const field of fieldsForTracking(tracking, 1)) {
    const { key } = field;
    const value = values[key];
    const zero = zeroWarning(key);

    if (value === 0) {
      if (zero) warnings.push({ key, message: zero });
      continue;
    }

    const previous = reference[key] ?? 0;
    const overCeiling = value > CEILING[key];
    const overJump = previous > 0 && value >= previous * JUMP;
    if (!overCeiling && !overJump) continue;

    const meant = withoutLastDigit(value);
    const plausible =
      meant !== null && meant <= CEILING[key] && (previous === 0 || meant < previous * JUMP);

    warnings.push({
      key,
      message: plausible
        ? `${describeValue(key, value)} — did you mean ${trimDecimal(meant)}?`
        : overCeiling
          ? `${describeValue(key, value)} — that looks like a slip.`
          : `${describeValue(key, value)} — last time was ${describeValue(key, previous)}.`,
    });
  }

  return warnings;
}

/**
 * What a zero means, per measure.
 *
 * Weight is the one that changed: since D14 a bodyweight exercise is logged
 * with a real load — he works out his bodyweight and enters it — so a 0 is an
 * unfinished entry rather than a way of saying "no added weight". It is still
 * accepted and still stored; the completion rule has not moved.
 */
function zeroWarning(key: MeasureKey): string | null {
  switch (key) {
    case "weightKg":
      return "0 kg — bodyweight still counts as a load. Work yours out and enter it.";
    case "reps":
      return "0 reps — a set with no reps counts for nothing.";
    case "minutes":
      return "0 min — nothing will be recorded for this set.";
    case "km":
      return "0 km — nothing will be recorded for this set.";
  }
}
