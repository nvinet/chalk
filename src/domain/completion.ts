/**
 * Chalk — the completion rule.
 *
 * Three rules, applied in order:
 *
 *  1. A machine counts as logged for a muscle group when at least one set
 *     against that pairing records both reps and weight — or a duration, for
 *     a timed machine. A machine touched but not written down does not count.
 *
 *  2. A muscle group succeeds when the number of *distinct* machines logged
 *     against it reaches its required count. A required count of 0 makes the
 *     group optional: shown, trainable, never blocking.
 *
 *  3. A session succeeds when every muscle group in its requirements has
 *     succeeded.
 *
 * The rule is deliberately exact rather than approximate. Because every set
 * names the muscle group it was performed for, nothing has to be inferred
 * from the machine, and there is no need for the primary/secondary muscle
 * weighting that inference-based trackers rely on.
 */

import type {
  Catalogue,
  Id,
  Machine,
  Session,
  SetEntry,
  TrackingType,
} from "./types.ts";

/** Rule 1. Does this single set count as real, recorded work? */
export function isSetLogged(set: SetEntry, tracking: TrackingType): boolean {
  if (set.skipped || !set.completed) return false;

  if (tracking === "duration") {
    return isPositive(set.durationSeconds);
  }

  // Reps must be positive. Weight must be present but may legitimately be
  // zero — a bodyweight-loaded machine such as the hack squat sled (Q7).
  return isPositive(set.reps) && isNonNegative(set.weightKg);
}

function isPositive(v: number | null | undefined): boolean {
  return typeof v === "number" && Number.isFinite(v) && v > 0;
}

function isNonNegative(v: number | null | undefined): boolean {
  return typeof v === "number" && Number.isFinite(v) && v >= 0;
}

/**
 * Rule 1, applied across a session: the distinct machines properly logged
 * for one muscle group. Multiple sets on the same machine count once —
 * the rule counts machines, not sets.
 */
export function machinesLoggedForGroup(
  session: Session,
  muscleGroupId: Id,
  machinesById: ReadonlyMap<Id, Machine>,
): Id[] {
  const found = new Set<Id>();
  for (const set of session.sets) {
    if (set.muscleGroupId !== muscleGroupId) continue;
    const machine = machinesById.get(set.machineId);
    if (!machine) continue;
    if (isSetLogged(set, machine.tracking)) found.add(set.machineId);
  }
  return [...found];
}

export interface MuscleGroupOutcome {
  muscleGroupId: Id;
  required: number;
  /** Distinct machines properly logged for this group in this session. */
  machineIds: Id[];
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
  machinesById: ReadonlyMap<Id, Machine>,
): MuscleGroupOutcome {
  const machineIds = machinesLoggedForGroup(session, muscleGroupId, machinesById);
  const optional = required <= 0;
  return {
    muscleGroupId,
    required,
    machineIds,
    loggedCount: machineIds.length,
    met: optional || machineIds.length >= required,
    optional,
  };
}

/** Rules 2 and 3 for a whole session. */
export function evaluateSession(
  session: Session,
  catalogue: Pick<Catalogue, "machines">,
): SessionOutcome {
  const machinesById = indexById(catalogue.machines);

  const groups = session.requirements.map((req) =>
    evaluateMuscleGroup(
      session,
      req.muscleGroupId,
      req.requiredMachineCount,
      machinesById,
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
      const machine = machinesById.get(set.machineId);
      return machine ? isSetLogged(set, machine.tracking) : false;
    }),
  };
}

/**
 * The muscle groups still standing between him and a successful session.
 * Drives the "Continue › Triceps" button on the session screen (W2).
 */
export function outstandingGroups(outcome: SessionOutcome): MuscleGroupOutcome[] {
  return outcome.groups.filter((g) => !g.met);
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
      requiredMachineCount: fmg.requiredMachineCount,
    }));
}

/** Machines mapped to a muscle group — the list behind wireframe W3. */
export function machinesForMuscleGroup(
  muscleGroupId: Id,
  catalogue: Pick<Catalogue, "machines" | "machineMuscleGroups">,
): Array<{ machine: Machine; variant?: string | null }> {
  const machinesById = indexById(catalogue.machines);
  return catalogue.machineMuscleGroups
    .filter((m) => m.muscleGroupId === muscleGroupId)
    .flatMap((m) => {
      const machine = machinesById.get(m.machineId);
      if (!machine || machine.archived) return [];
      return [{ machine, variant: m.variant }];
    });
}

export function indexById<T extends { id: Id }>(rows: T[]): Map<Id, T> {
  return new Map(rows.map((r) => [r.id, r]));
}
