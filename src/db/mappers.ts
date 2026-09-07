/**
 * Drizzle rows in, domain types out.
 *
 * This is the seam that keeps `src/domain/` free of Drizzle: nothing above
 * this file knows what a row looks like, and nothing below it knows what the
 * completion rule is. Every function here is pure, so it is testable without
 * a simulator.
 *
 * Imports use explicit `.ts` extensions so Node's test runner can load this
 * module directly. The schema import is type-only and strips away at runtime.
 */

import type { Family, Exercise, MuscleGroup, TrackingType } from "../domain/types.ts";
import type { FamilyRow, ExerciseRow, MuscleGroupRow } from "./schema.ts";

const TRACKING_TYPES: readonly string[] = ["weightReps", "duration", "distance"];

/**
 * SQLite stores `tracking` as free text, so narrow it on the way out.
 *
 * An unrecognised value means a corrupted row or a database written by a newer
 * build, neither of which should stop him logging mid-session — so it falls
 * back to `weightReps` rather than throwing. The fallback is the conservative
 * one: it asks for reps and weight, which is the most he could be expected to
 * enter, rather than silently accepting an empty set.
 */
export function toTrackingType(value: string): TrackingType {
  return TRACKING_TYPES.includes(value) ? (value as TrackingType) : "weightReps";
}

export function toFamily(row: FamilyRow): Family {
  return {
    id: row.id,
    name: row.name,
    position: row.position,
    usesMuscleGroups: row.usesMuscleGroups,
  };
}

export function toMuscleGroup(row: MuscleGroupRow): MuscleGroup {
  return {
    id: row.id,
    name: row.name,
    position: row.position,
    implicit: row.implicit,
    archived: row.archived,
  };
}

export function toExercise(row: ExerciseRow): Exercise {
  return {
    id: row.id,
    name: row.name,
    aliases: row.aliases,
    tracking: toTrackingType(row.tracking),
    weightIncrementKg: row.weightIncrementKg,
    defaultRestSeconds: row.defaultRestSeconds,
    notes: row.notes,
    archived: row.archived,
  };
}
