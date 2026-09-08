/**
 * Chalk — the completion rule.
 *
 * Three rules, applied in order:
 *
 *  1. An exercise counts as logged for a muscle group when at least one set
 *     against that pairing records both reps and weight — or a duration, for
 *     a timed exercise. An exercise touched but not written down does not count.
 *
 *  2. A muscle group succeeds when the number of *distinct* exercises logged
 *     against it reaches its required count. A required count of 0 makes the
 *     group optional: shown, trainable, never blocking.
 *
 *  3. A session succeeds when every muscle group in its requirements has
 *     succeeded.
 *
 * The rule is deliberately exact rather than approximate. Because every set
 * names the muscle group it was performed for, nothing has to be inferred
 * from the exercise, and there is no need for the primary/secondary muscle
 * weighting that inference-based trackers rely on.
 */

import type {
  Catalogue,
  Exercise,
  Id,
  Session,
  SetEntry,
  SkipReason,
  TrackingType,
} from "./types.ts";
export { isWeightBased } from "./types.ts";

/**
 * Rule 1. Does this single set count as real, recorded work?
 *
 * This is the one predicate the completion rule and the whole of scoring.ts
 * go through, so "a set that counted" means the same thing everywhere — which
 * is why excluding warm-ups here also excludes them from volume and from
 * personal bests (D15).
 */
export function isSetLogged(set: SetEntry, tracking: TrackingType): boolean {
  if (set.skipped || !set.completed) return false;

  // A warm-up is kept, but counts for nothing at all (D15).
  if (set.warmup) return false;

  switch (tracking) {
    case "duration":
      return isPositive(set.durationSeconds);
    case "distance":
      return isPositive(set.distanceM);
    case "weightReps":
      // Reps must be positive. Weight must be present but may be zero: logging
      // is never blocked. On a bodyweight exercise a 0 is an incomplete entry
      // rather than a correct one — he enters his bodyweight as the load
      // (D14) — so it warns elsewhere, it does not fail here.
      return isPositive(set.reps) && isNonNegative(set.weightKg);
  }
}

function isPositive(v: number | null | undefined): boolean {
  return typeof v === "number" && Number.isFinite(v) && v > 0;
}

function isNonNegative(v: number | null | undefined): boolean {
  return typeof v === "number" && Number.isFinite(v) && v >= 0;
}

/**
 * Rule 1, applied across a session: the distinct exercises properly logged
 * for one muscle group. Multiple sets on the same exercise count once —
 * the rule counts exercises, not sets.
 */
export function exercisesLoggedForGroup(
  session: Session,
  muscleGroupId: Id,
  exercisesById: ReadonlyMap<Id, Exercise>,
): Id[] {
  const found = new Set<Id>();
  for (const set of session.sets) {
    if (set.muscleGroupId !== muscleGroupId) continue;
    const exercise = exercisesById.get(set.exerciseId);
    if (!exercise) continue;
    if (isSetLogged(set, exercise.tracking)) found.add(set.exerciseId);
  }
  return [...found];
}

export interface MuscleGroupOutcome {
  muscleGroupId: Id;
  required: number;
  /** He passed on this group deliberately, and said why (#24). */
  skipped: boolean;
  skipReason?: SkipReason | null;
  /** Distinct exercises properly logged for this group in this session. */
  exerciseIds: Id[];
  loggedCount: number;
  met: boolean;
  /** True when required is 0 — visible in the session but never blocking. */
  optional: boolean;
}

export interface SessionOutcome {
  sessionId: Id;
  familyId: Id;
  groups: MuscleGroupOutcome[];
  /** Rule 3: every required group met. */
  successful: boolean;
  /** Counts only groups that could fail, so an optional group cannot flatter the score. */
  requiredGroupsMet: number;
  requiredGroupsTotal: number;
  /** True once anything at all has been logged — used for weekly attendance (C3). */
  attended: boolean;
}

/** Rule 2, for one muscle group. */
export function evaluateMuscleGroup(
  session: Session,
  muscleGroupId: Id,
  required: number,
  exercisesById: ReadonlyMap<Id, Exercise>,
): MuscleGroupOutcome {
  const exerciseIds = exercisesLoggedForGroup(session, muscleGroupId, exercisesById);
  const optional = required <= 0;
  const requirement = session.requirements.find(
    (r) => r.muscleGroupId === muscleGroupId,
  );

  return {
    muscleGroupId,
    required,
    // Skipping says why a group went untrained. It is deliberately absent from
    // `met`: a skipped group with a required count above 0 fails the session
    // honestly rather than silently satisfying it (#24).
    skipped: requirement?.skipped ?? false,
    skipReason: requirement?.skipReason ?? null,
    exerciseIds,
    loggedCount: exerciseIds.length,
    met: optional || exerciseIds.length >= required,
    optional,
  };
}

/** Rules 2 and 3 for a whole session. */
export function evaluateSession(
  session: Session,
  catalogue: Pick<Catalogue, "exercises">,
): SessionOutcome {
  const exercisesById = indexById(catalogue.exercises);

  const groups = session.requirements.map((req) =>
    evaluateMuscleGroup(
      session,
      req.muscleGroupId,
      req.requiredExerciseCount,
      exercisesById,
    ),
  );

  const required = groups.filter((g) => !g.optional);

  return {
    sessionId: session.id,
    familyId: session.familyId,
    groups,
    successful: groups.every((g) => g.met),
    requiredGroupsMet: required.filter((g) => g.met).length,
    requiredGroupsTotal: required.length,
    attended: session.sets.some((set) => {
      const exercise = exercisesById.get(set.exerciseId);
      return exercise ? isSetLogged(set, exercise.tracking) : false;
    }),
  };
}

/**
 * The muscle groups still standing between him and a successful session.
 * Drives the "Continue › Triceps" button on the session screen (W2).
 *
 * A skipped group is left out: it still fails the session, but he has already
 * decided about it, so pointing him back at it would be nagging.
 */
export function outstandingGroups(outcome: SessionOutcome): MuscleGroupOutcome[] {
  return outcome.groups.filter((g) => !g.met && !g.skipped);
}

/** Build the requirement snapshot for a new session from the current catalogue. */
export function requirementsForFamily(
  familyId: Id,
  catalogue: Pick<Catalogue, "familyMuscleGroups">,
) {
  return catalogue.familyMuscleGroups
    .filter((fmg) => fmg.familyId === familyId)
    .sort((a, b) => a.position - b.position)
    .map((fmg) => ({
      muscleGroupId: fmg.muscleGroupId,
      requiredExerciseCount: fmg.requiredExerciseCount,
    }));
}

/** Exercises mapped to a muscle group — the list behind wireframe W3. */
export function exercisesForMuscleGroup(
  muscleGroupId: Id,
  catalogue: Pick<Catalogue, "exercises" | "exerciseMuscleGroups">,
): Exercise[] {
  const exercisesById = indexById(catalogue.exercises);
  return catalogue.exerciseMuscleGroups
    .filter((m) => m.muscleGroupId === muscleGroupId)
    .flatMap((m) => {
      const exercise = exercisesById.get(m.exerciseId);
      if (!exercise || exercise.archived) return [];
      return [exercise];
    });
}

export function indexById<T extends { id: Id }>(rows: T[]): Map<Id, T> {
  return new Map(rows.map((r) => [r.id, r]));
}
