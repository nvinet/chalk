/**
 * Chalk — seed catalogue.
 *
 * One exercise per column of the original spreadsheet. That is deliberate: the
 * source data was already exercise-grained — "SM incline bench press" is one
 * column, and the cable station appears as three ("cable pull up", "cable
 * forearm curl", "trycept pushdown"). D7 makes the spreadsheet the source of
 * the taxonomy, so the taxonomy matches it.
 *
 * Equipment is not modelled. It lives in the name, as it did in the
 * spreadsheet.
 *
 * Still a proposal, expected to be corrected before M1 is signed off (Q25,
 * Q26, Q27): rear delt row's group, whether hips should be two groups, and
 * what belongs under abs and cardio (Q28).
 */

import type { Catalogue } from "../domain/types.ts";

const REST = 90;
const STEP = 2.5;

export const seedCatalogue: Catalogue = {
  families: [
    { id: "push", name: "Push", position: 1, usesMuscleGroups: true },
    { id: "pull", name: "Pull", position: 2, usesMuscleGroups: true },
    { id: "legs", name: "Legs", position: 3, usesMuscleGroups: true },
    { id: "abs", name: "Abs", position: 4, usesMuscleGroups: false },
    { id: "cardio", name: "Cardio", position: 5, usesMuscleGroups: false },
  ],

  muscleGroups: [
    { id: "chest", name: "Chest", position: 1 },
    { id: "shoulders", name: "Shoulders", position: 2 },
    { id: "triceps", name: "Triceps", position: 3 },
    { id: "back", name: "Back", position: 4 },
    { id: "biceps", name: "Biceps", position: 5 },
    { id: "forearms", name: "Forearms", position: 6 },
    { id: "quads", name: "Quads", position: 7 },
    { id: "hamstrings", name: "Hamstrings", position: 8 },
    { id: "calves", name: "Calves", position: 9 },
    { id: "hips", name: "Hips", position: 10 },
    // Families without muscle groups still need one, so that a single
    // completion rule covers everything. Never shown in the UI.
    { id: "abs-all", name: "Abs", position: 11, implicit: true },
    { id: "cardio-all", name: "Cardio", position: 12, implicit: true },
  ],

  familyMuscleGroups: [
    { familyId: "push", muscleGroupId: "chest", position: 1, requiredExerciseCount: 1 },
    { familyId: "push", muscleGroupId: "shoulders", position: 2, requiredExerciseCount: 1 },
    { familyId: "push", muscleGroupId: "triceps", position: 3, requiredExerciseCount: 1 },

    { familyId: "pull", muscleGroupId: "back", position: 1, requiredExerciseCount: 1 },
    { familyId: "pull", muscleGroupId: "biceps", position: 2, requiredExerciseCount: 1 },
    // Forearms failed all three historical pull sessions on a count of 1 —
    // it has one exercise and was skipped both times it appeared (§3.4).
    // Shipped optional; he can raise it once he decides (Q27).
    { familyId: "pull", muscleGroupId: "forearms", position: 3, requiredExerciseCount: 0 },

    { familyId: "legs", muscleGroupId: "quads", position: 1, requiredExerciseCount: 1 },
    { familyId: "legs", muscleGroupId: "hamstrings", position: 2, requiredExerciseCount: 1 },
    { familyId: "legs", muscleGroupId: "calves", position: 3, requiredExerciseCount: 1 },
    { familyId: "legs", muscleGroupId: "hips", position: 4, requiredExerciseCount: 1 },

    { familyId: "abs", muscleGroupId: "abs-all", position: 1, requiredExerciseCount: 1 },
    { familyId: "cardio", muscleGroupId: "cardio-all", position: 1, requiredExerciseCount: 1 },
  ],

  exercises: [
    // Push
    lift("pec-fly", "Pec fly", ["peck fly"]),
    lift("sm-incline-bench-press", "SM incline bench press", ["SM incline bench press"]),
    lift("bench-press-flat", "Bench press (flat)", []),
    lift("lateral-raise", "Lateral raise", ["lateral rases"], 1),
    lift("shoulder-press", "Shoulder press", []),
    lift("rear-delt-row", "Rear delt row", [], 1),
    lift("tricep-pushdown", "Tricep pushdown", ["trycept pushdown"]),
    lift("tricep-overhead-extension", "Tricep overhead extension", ["trycept overhead extension"], 1),

    // Pull
    lift("lat-pulldown", "Lat pulldown", ["lat pull down"]),
    lift("cable-pull-up", "Cable pull-up", ["cable pull up"]),
    lift("seated-row-horizontal", "Seated row (horizontal)", []),
    lift("seated-row-vertical", "Seated row (vertical)", []),
    lift("t-bar-row", "T-bar row", []),
    lift("machine-preacher-curl", "Machine preacher curl", [], 1),
    lift("incline-bench-curl", "Incline bench bicep curl", ["incline bench bycept curl"], 1),
    lift("hammer-curl", "Hammer curl", [], 1),
    lift("cable-forearm-curl", "Cable forearm curl", ["cable forearm curl"], 1),

    // Legs
    lift("hack-squat", "Hack squat", ["hax squat"]),
    lift("quad-extension", "Quad extension", ["quad extention"]),
    lift("hamstring-curl", "Hamstring curl", []),
    lift("calf-raise", "Calf raise", ["calve rases"]),
    lift("hip-abduction", "Hip abduction", ["hip abductor"]),
    lift("hip-adduction", "Hip adduction", ["hip adductor"]),
  ],

  exerciseMuscleGroups: [
    // Push
    { exerciseId: "pec-fly", muscleGroupId: "chest" },
    { exerciseId: "sm-incline-bench-press", muscleGroupId: "chest" },
    { exerciseId: "bench-press-flat", muscleGroupId: "chest" },
    { exerciseId: "lateral-raise", muscleGroupId: "shoulders" },
    { exerciseId: "shoulder-press", muscleGroupId: "shoulders" },
    { exerciseId: "rear-delt-row", muscleGroupId: "shoulders" },
    { exerciseId: "tricep-pushdown", muscleGroupId: "triceps" },
    { exerciseId: "tricep-overhead-extension", muscleGroupId: "triceps" },

    // Pull
    { exerciseId: "lat-pulldown", muscleGroupId: "back" },
    { exerciseId: "cable-pull-up", muscleGroupId: "back" },
    { exerciseId: "seated-row-horizontal", muscleGroupId: "back" },
    { exerciseId: "seated-row-vertical", muscleGroupId: "back" },
    { exerciseId: "t-bar-row", muscleGroupId: "back" },
    { exerciseId: "machine-preacher-curl", muscleGroupId: "biceps" },
    { exerciseId: "incline-bench-curl", muscleGroupId: "biceps" },
    // The surviving many-to-many: one movement, two groups. Logging it for
    // biceps does nothing for forearms — the set says which (D4).
    { exerciseId: "hammer-curl", muscleGroupId: "biceps" },
    { exerciseId: "hammer-curl", muscleGroupId: "forearms" },
    { exerciseId: "cable-forearm-curl", muscleGroupId: "forearms" },

    // Legs
    { exerciseId: "hack-squat", muscleGroupId: "quads" },
    { exerciseId: "quad-extension", muscleGroupId: "quads" },
    { exerciseId: "hamstring-curl", muscleGroupId: "hamstrings" },
    { exerciseId: "calf-raise", muscleGroupId: "calves" },
    { exerciseId: "hip-abduction", muscleGroupId: "hips" },
    { exerciseId: "hip-adduction", muscleGroupId: "hips" },

    // Abs and cardio have no exercises yet — Q28.
  ],
};

function lift(
  id: string,
  name: string,
  aliases: string[],
  weightIncrementKg: number = STEP,
) {
  return {
    id,
    name,
    aliases,
    tracking: "weightReps" as const,
    weightIncrementKg,
    defaultRestSeconds: REST,
  };
}

/** For when Q28 is answered: cardio exercises record time, not weight. */
export function timedExercise(id: string, name: string) {
  return {
    id,
    name,
    aliases: [] as string[],
    tracking: "duration" as const,
    weightIncrementKg: 0,
    defaultRestSeconds: 0,
  };
}
