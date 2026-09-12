/**
 * Chalk — the completion rule.
 *
 * Three rules, applied in order:
 *
 *  1. An exercise counts as logged for a muscle group when enough *working*
 *     sets against that pairing are properly recorded — reps and weight, or a
 *     duration, or a distance. "Enough" is the exercise's `minimumSets`,
 *     three by default, and applies to weight/reps only: timed and distance
 *     exercises count on one qualifying entry (D23). An exercise touched but
 *     not written down does not count.
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
 * How many working sets complete this exercise (D23).
 *
 * Three by default for weight/reps, tuned per exercise. One for timed and
 * distance, which is not a default but the only reading that means anything:
 * a run is not three runs.
 *
 * Floored at 1 so a zero or a negative in the database cannot make an exercise
 * complete itself without a single set.
 */
export function setsRequiredFor(exercise: Exercise): number {
  if (exercise.tracking !== "weightReps") return 1;
  return Math.max(1, exercise.minimumSets);
}

/**
 * Rule 1, counted: qualifying sets per exercise for one muscle group.
 *
 * Sets rather than exercises — the threshold is applied a level up, in
 * `exercisesLoggedForGroup`. Everything still goes through `isSetLogged`, so
 * warm-ups are excluded here exactly as they are everywhere else (D15), which
 * is what makes "three sets" mean three *working* sets without saying so
 * twice.
 *
 * Exposed because the screens need the partial state: an exercise on its
 * second of three sets is neither done nor untouched, and before D23 there was
 * no such thing to render.
 */
export function setsLoggedForGroup(
  session: Session,
  muscleGroupId: Id,
  exercisesById: ReadonlyMap<Id, Exercise>,
): Map<Id, number> {
  const counts = new Map<Id, number>();
  for (const set of session.sets) {
    if (set.muscleGroupId !== muscleGroupId) continue;
    const exercise = exercisesById.get(set.exerciseId);
    if (!exercise) continue;
    if (!isSetLogged(set, exercise.tracking)) continue;
    counts.set(set.exerciseId, (counts.get(set.exerciseId) ?? 0) + 1);
  }
  return counts;
}

/**
 * Rule 1, applied across a session: the distinct exercises that have reached
 * their set requirement for one muscle group.
 *
 * Still distinct exercises — logging a fourth set of the same exercise does
 * not earn a second credit. What changed with D23 is only how many sets it
 * takes to earn the first.
 */
export function exercisesLoggedForGroup(
  session: Session,
  muscleGroupId: Id,
  exercisesById: ReadonlyMap<Id, Exercise>,
): Id[] {
  const counts = setsLoggedForGroup(session, muscleGroupId, exercisesById);
  const found: Id[] = [];
  for (const [exerciseId, logged] of counts) {
    const exercise = exercisesById.get(exerciseId);
    if (exercise && logged >= setsRequiredFor(exercise)) found.push(exerciseId);
  }
  return found;
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
  /**
   * Qualifying sets for this group, across every exercise — including sets on
   * an exercise that has not yet reached its requirement.
   *
   * Distinct from `loggedCount` since D23: two sets of a three-set exercise
   * leave `loggedCount` at 0, and a screen that read that alone would say
   * nothing had been logged while he stood there having done two.
   */
  loggedSetCount: number;
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
  const setCounts = setsLoggedForGroup(session, muscleGroupId, exercisesById);
  const exerciseIds: Id[] = [];
  let loggedSetCount = 0;
  for (const [exerciseId, logged] of setCounts) {
    const exercise = exercisesById.get(exerciseId);
    if (!exercise) continue;
    loggedSetCount += logged;
    if (logged >= setsRequiredFor(exercise)) exerciseIds.push(exerciseId);
  }
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
    loggedSetCount,
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
