/**
 * The catalogue: what exists to be trained, and how it relates.
 *
 * Reference data. Seeded on first launch and edited rarely — as distinct from
 * `sessions.ts`, which records what actually happened. Sessions refer to these
 * rows and must never be able to delete one, which is why machines and muscle
 * groups archive rather than disappear.
 *
 * The taxonomy is three levels: family → muscle group → machine.
 *  - A family is a training day (push, pull, legs, abs, cardio).
 *  - A muscle group sits inside a family and is what a session is scored on.
 *  - A machine sits under one or more muscle groups, possibly across families.
 *
 * Abs and cardio have no muscle groups. They are modelled with a single
 * implicit group so that one completion rule covers every family; the UI
 * never shows an implicit group.
 */

import type { Id } from "./common.ts";

/**
 * What a machine records. One measure per machine (D12) — the measure never
 * varies set to set, which is what keeps each machine's history comparable.
 *
 *  - `weightReps`  reps and a weight. Bodyweight machines record a real weight
 *                  too: he works out his bodyweight and enters it (D14).
 *  - `duration`    seconds. HIIT, rowing.
 *  - `distance`    metres, displayed as km. Jogging, swimming.
 */
export type TrackingType = "weightReps" | "duration" | "distance";

/**
 * True when the measure is reps-and-weight, so volume, estimated 1RM and
 * personal bests mean something.
 *
 * Exists because the engine used to ask `tracking === "duration"` and treat
 * everything else as weights. Adding `distance` silently made that wrong —
 * a run would have recorded a heaviest of 0 kg. Ask this instead (D12).
 */
export function isWeightBased(tracking: TrackingType): boolean {
  return tracking === "weightReps";
}

export interface Family {
  id: Id;
  name: string;
  position: number;
  /** False for abs and cardio: their single muscle group is never shown. */
  usesMuscleGroups: boolean;
}

export interface MuscleGroup {
  id: Id;
  name: string;
  position: number;
  /** True for the placeholder group belonging to a family without groups. */
  implicit?: boolean;
  archived?: boolean;
}

/**
 * Which muscle groups make up a family, and how many machines each needs.
 * The count lives here rather than on the muscle group, so the same group
 * can require different amounts in different families.
 */
export interface FamilyMuscleGroup {
  familyId: Id;
  muscleGroupId: Id;
  position: number;
  /** 0 means optional: the group is shown but can never fail a session. */
  requiredMachineCount: number;
}

export interface Machine {
  id: Id;
  name: string;
  /** Original spreadsheet spellings, kept so search still finds them. */
  aliases: string[];
  tracking: TrackingType;
  /** Step size for the +/- controls. Ignored for timed machines. */
  weightIncrementKg: number;
  defaultRestSeconds: number;
  notes?: string | null;
  archived?: boolean;
}

/**
 * What a machine may be used for. Many-to-many, and may cross families:
 * the Smith machine is chest and shoulders in push, and quads in legs.
 *
 * This mapping says what is *possible*. It grants no credit on its own —
 * credit comes from a SetEntry naming the muscle group explicitly.
 */
export interface MachineMuscleGroup {
  machineId: Id;
  muscleGroupId: Id;
  /** How it is used for this group: "incline press", "squat", "pushdown". */
  variant?: string | null;
}

/**
 * One recorded set. Carries both the machine and the muscle group, which is
 * what allows the same machine to be logged twice in a session for two
 * different groups without either use counting for the other.
 */

/** Everything the completion rule needs to look things up. */
export interface Catalogue {
  families: Family[];
  muscleGroups: MuscleGroup[];
  familyMuscleGroups: FamilyMuscleGroup[];
  machines: Machine[];
  machineMuscleGroups: MachineMuscleGroup[];
}
