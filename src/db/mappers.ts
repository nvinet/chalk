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

import type {
  Exercise,
  Family,
  MuscleGroup,
  Session,
  SessionRequirement,
  SessionStatus,
  SetEntry,
  SkipReason,
  TrackingType,
} from "../domain/types.ts";
import type {
  ExerciseRow,
  FamilyRow,
  MuscleGroupRow,
  SessionRow,
  SetEntryRow,
} from "./schema.ts";

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

/* ---------------------------------------------------------------- sessions */

/**
 * `status` and `skip_reason` are free text in SQLite, so both narrow on the way
 * out. As with tracking, an unrecognised value falls back rather than throwing:
 * a corrupt row must not stop him mid-session.
 */
const SESSION_STATUSES: readonly string[] = ["inProgress", "finished", "abandoned"];

export function toSessionStatus(value: string): SessionStatus {
  return SESSION_STATUSES.includes(value) ? (value as SessionStatus) : "inProgress";
}

const SKIP_REASONS: readonly string[] = [
  "equipmentBusy",
  "equipmentBroken",
  "injury",
  "shortOfTime",
  "other",
];

export function toSkipReason(value: string | null): SkipReason | null {
  if (value === null) return null;
  return SKIP_REASONS.includes(value) ? (value as SkipReason) : "other";
}

export function toSetEntry(row: SetEntryRow): SetEntry {
  return {
    id: row.id,
    sessionId: row.sessionId,
    exerciseId: row.exerciseId,
    muscleGroupId: row.muscleGroupId,
    setNumber: row.setNumber,
    reps: row.reps,
    weightKg: row.weightKg,
    durationSeconds: row.durationSeconds,
    distanceM: row.distanceM,
    warmup: row.warmup,
    completed: row.completed,
    skipped: row.skipped,
    skipReason: toSkipReason(row.skipReason),
    note: row.note,
  };
}

/**
 * A session is only meaningful with its requirements and sets, so it is
 * assembled from three queries rather than mapped from one row.
 */
export function toSession(
  row: SessionRow,
  requirements: SessionRequirement[],
  sets: SetEntry[],
): Session {
  return {
    id: row.id,
    familyId: row.familyId,
    date: row.date,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    status: toSessionStatus(row.status),
    requirements,
    sets,
    notes: row.notes,
  };
}
