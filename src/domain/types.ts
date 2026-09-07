/**
 * Chalk — domain types.
 *
 * Pure TypeScript. No React, no Drizzle, no Expo. Everything in `domain/`
 * must stay portable, because it is the part worth keeping if the app is
 * ever rebuilt natively.
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

export type Id = string;
/** ISO date, `YYYY-MM-DD`. */
export type IsoDate = string;
/** ISO 8601 timestamp. */
export type IsoTimestamp = string;

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

export type SessionStatus = "inProgress" | "finished" | "abandoned";

export type SkipReason =
  | "machineBusy"
  | "machineBroken"
  | "injury"
  | "shortOfTime"
  | "other";

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
export interface SetEntry {
  id: Id;
  sessionId?: Id;
  machineId: Id;
  muscleGroupId: Id;
  setNumber: number;
  reps?: number | null;
  weightKg?: number | null;
  durationSeconds?: number | null;
  /** Canonical metres, displayed as km (D12). */
  distanceM?: number | null;
  /** Kept, but counts for nothing: not completion, not bests, not volume (D15). */
  warmup?: boolean;
  completed: boolean;
  skipped: boolean;
  skipReason?: SkipReason | null;
  note?: string | null;
}

/**
 * The requirement that applied when the session happened. Snapshotted onto
 * the session so that raising chest from one machine to two in November
 * cannot retrospectively fail August.
 */
export interface SessionRequirement {
  muscleGroupId: Id;
  requiredMachineCount: number;
}

export interface Session {
  id: Id;
  familyId: Id;
  date: IsoDate;
  startedAt: IsoTimestamp;
  finishedAt?: IsoTimestamp | null;
  status: SessionStatus;
  requirements: SessionRequirement[];
  sets: SetEntry[];
  notes?: string | null;
}

/** Everything the completion rule needs to look things up. */
export interface Catalogue {
  families: Family[];
  muscleGroups: MuscleGroup[];
  familyMuscleGroups: FamilyMuscleGroup[];
  machines: Machine[];
  machineMuscleGroups: MachineMuscleGroup[];
}
