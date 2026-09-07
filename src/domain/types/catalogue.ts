/**
 * The catalogue: what exists to be trained, and how it relates.
 *
 * Reference data. Seeded on first launch and edited rarely — as distinct from
 * `sessions.ts`, which records what actually happened. Sessions refer to these
 * rows and must never be able to delete one, which is why exercises and muscle
 * groups archive rather than disappear.
 *
 * The taxonomy is three levels: family → muscle group → exercise.
 *  - A family is a training day (push, pull, legs, abs, cardio).
 *  - A muscle group sits inside a family and is what a session is scored on.
 *  - An exercise sits under one or more muscle groups, possibly across families.
 *
 * Abs and cardio have no muscle groups. They are modelled with a single
 * implicit group so that one completion rule covers every family; the UI
 * never shows an implicit group.
 */

import type { Id } from "./common.ts";

/**
 * What an exercise records. One measure per exercise (D12) — the measure never
 * varies set to set, which is what keeps each exercise's history comparable.
 *
 *  - `weightReps`  reps and a weight. Bodyweight exercises record a real weight
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
 * Which muscle groups make up a family, and how many exercises each needs.
 * The count lives here rather than on the muscle group, so the same group
 * can require different amounts in different families.
 */
export interface FamilyMuscleGroup {
  familyId: Id;
  muscleGroupId: Id;
  position: number;
  /** 0 means optional: the group is shown but can never fail a session. */
  requiredExerciseCount: number;
}

export interface Exercise {
  id: Id;
  name: string;
  /** Original spreadsheet spellings, kept so search still finds them. */
  aliases: string[];
  tracking: TrackingType;
  /** Step size for the +/- controls. Ignored for timed exercises. */
  weightIncrementKg: number;
  defaultRestSeconds: number;
  notes?: string | null;
  archived?: boolean;
}

/**
 * What an exercise counts towards. Many-to-many, and may cross families —
 * hammer curl is biceps and forearms.
 *
 * Rarer than when this modelled machines: the Smith machine served three
 * groups through three different movements, and those are now three separate
 * exercises. What remains is the genuine case — one movement worked for two
 * groups.
 *
 * This mapping says what is *possible*. It grants no credit on its own —
 * credit comes from a SetEntry naming the muscle group explicitly.
 */
export interface ExerciseMuscleGroup {
  exerciseId: Id;
  muscleGroupId: Id;
}

/**
 * One recorded set. Carries both the exercise and the muscle group, which is
 * what allows the same exercise to be logged twice in a session for two
 * different groups without either use counting for the other.
 */

/** Everything the completion rule needs to look things up. */
export interface Catalogue {
  families: Family[];
  muscleGroups: MuscleGroup[];
  familyMuscleGroups: FamilyMuscleGroup[];
  exercises: Exercise[];
  exerciseMuscleGroups: ExerciseMuscleGroup[];
}
