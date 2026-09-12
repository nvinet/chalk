/**
 * Chalk — seed catalogue.
 *
 * The agreed catalogue from #2, not the spreadsheet. The spreadsheet was the
 * original source of the taxonomy (D7) but stopped earning that place: two of
 * its columns cannot be resolved without archaeology, and this catalogue is
 * finer-grained than anything it can supply. Historical data may be retrofitted
 * later, or not at all (D18).
 *
 * One exercise per row of that table. Equipment is not modelled — it lives in
 * the name (D17).
 *
 * Aliases carry the old spreadsheet spellings so search still finds them
 * (#17), even though no spreadsheet data is imported.
 *
 * Every required count is 1, confirmed by D23 rather than inherited; a
 * successful legs session therefore needs all five of its groups. Forearms is 1
 * like the rest: D3 wanted it optional when it had a single machine, and D18
 * gave it two.
 */

import type { Catalogue } from "../domain/types.ts";

const REST = 90;
/** Working sets to complete a weight/reps exercise (D23). */
const SETS = 3;
const STEP = 2.5;

export const seedCatalogue: Catalogue = {
  families: [
    { id: "push", name: "Push", position: 1, usesMuscleGroups: true },
    { id: "pull", name: "Pull", position: 2, usesMuscleGroups: true },
    { id: "legs", name: "Legs", position: 3, usesMuscleGroups: true },
    // Abs now has real muscle groups, unlike cardio (D18, superseding D1).
    { id: "abs", name: "Abs", position: 4, usesMuscleGroups: true },
    { id: "cardio", name: "Cardio", position: 5, usesMuscleGroups: false },
  ],

  muscleGroups: [
    { id: "chest", name: "Chest", position: 1 },
    { id: "shoulders", name: "Shoulders", position: 2 },
    { id: "triceps", name: "Triceps", position: 3 },
    { id: "lats", name: "Lats", position: 4 },
    { id: "mid-back", name: "Mid-back", position: 5 },
    { id: "biceps", name: "Biceps", position: 6 },
    { id: "forearms", name: "Forearms", position: 7 },
    { id: "quads", name: "Quads", position: 8 },
    { id: "hamstrings", name: "Hamstrings", position: 9 },
    { id: "calves", name: "Calves", position: 10 },
    { id: "glutes", name: "Glutes", position: 11 },
    { id: "whole-leg", name: "Whole leg", position: 12 },
    { id: "lower-abs", name: "Lower abs", position: 13 },
    { id: "upper-abs", name: "Upper abs", position: 14 },
    { id: "obliques", name: "Obliques", position: 15 },
    // Cardio has no muscle groups, so it carries one implicit group and a
    // single completion rule still covers every family. Never shown in the UI.
    { id: "cardio-all", name: "Cardio", position: 16, implicit: true },
  ],

  familyMuscleGroups: [
    { familyId: "push", muscleGroupId: "chest", position: 1, requiredExerciseCount: 1 },
    { familyId: "push", muscleGroupId: "shoulders", position: 2, requiredExerciseCount: 1 },
    { familyId: "push", muscleGroupId: "triceps", position: 3, requiredExerciseCount: 1 },

    { familyId: "pull", muscleGroupId: "lats", position: 1, requiredExerciseCount: 1 },
    { familyId: "pull", muscleGroupId: "mid-back", position: 2, requiredExerciseCount: 1 },
    { familyId: "pull", muscleGroupId: "biceps", position: 3, requiredExerciseCount: 1 },
    { familyId: "pull", muscleGroupId: "forearms", position: 4, requiredExerciseCount: 1 },

    { familyId: "legs", muscleGroupId: "quads", position: 1, requiredExerciseCount: 1 },
    { familyId: "legs", muscleGroupId: "hamstrings", position: 2, requiredExerciseCount: 1 },
    { familyId: "legs", muscleGroupId: "calves", position: 3, requiredExerciseCount: 1 },
    { familyId: "legs", muscleGroupId: "glutes", position: 4, requiredExerciseCount: 1 },
    { familyId: "legs", muscleGroupId: "whole-leg", position: 5, requiredExerciseCount: 1 },

    { familyId: "abs", muscleGroupId: "lower-abs", position: 1, requiredExerciseCount: 1 },
    { familyId: "abs", muscleGroupId: "upper-abs", position: 2, requiredExerciseCount: 1 },
    { familyId: "abs", muscleGroupId: "obliques", position: 3, requiredExerciseCount: 1 },

    { familyId: "cardio", muscleGroupId: "cardio-all", position: 1, requiredExerciseCount: 1 },
  ],

  exercises: [
    // Push
    lift("pec-fly", "Pec fly", ["peck fly"]),
    lift("sm-incline-bench-press", "Smith machine incline bench press", ["SM incline bench press"]),
    lift("bench-press-flat", "Bench press (flat)", []),
    lift("lateral-raise", "Lateral raises", ["lateral rases"], 1),
    lift("shoulder-press", "Shoulder press", []),
    lift("rear-delt-fly", "Rear delt fly", ["rear delt row"], 1),
    lift("tricep-pushdown", "Tricep pushdown", ["trycept pushdown"]),
    lift("tricep-overhead-extension", "Tricep overhead extension", ["trycept overhead extension"], 1),
    lift("single-arm-tricep-pushdown", "Single arm tricep pushdown", [], 1),

    // Pull
    lift("lat-pulldown", "Lat pulldown", ["lat pull down"]),
    lift("cable-pull-up", "Cable pull-up", ["cable pull up"]),
    lift("seated-row-vertical", "Seated row (vertical)", []),
    lift("seated-row-horizontal", "Seated row (horizontal)", []),
    lift("machine-preacher-curl", "Machine preacher curl", [], 1),
    lift("incline-bench-curl", "Incline bench biceps curl", ["incline bench bycept curl"], 1),
    lift("reverse-curl", "Reverse curl", [], 1),
    lift("hammer-curl", "Hammer curl", [], 1),
    lift("cable-forearm-curl", "Cable forearm curl", [], 1),

    // Legs
    lift("quad-extension", "Quad extension", ["quad extention"]),
    lift("hip-adduction", "Hip adductor", []),
    lift("hamstring-curl", "Hamstring curl", []),
    lift("calf-raise", "Calf raises", ["calve rases"]),
    lift("hip-abduction", "Hip abductor", []),
    lift("hip-thrust", "Hip thrust", []),
    lift("hack-squat", "Hack squat", ["hax squat"]),
    lift("leg-press", "Leg press", []),
    lift("squat", "Squat", []),

    // Abs
    lift("decline-sit-up", "Decline sit-up", [], 1),
    lift("cable-crunch", "Cable crunch", [], 1),
    lift("cable-woodchop", "Cable woodchops", [], 1),

    // Cardio — one measure each, fixed per exercise (D12)
    distance("swimming", "Swimming"),
    distance("running", "Running"),
    distance("cycling", "Cycling"),
    timed("rowing", "Rowing"),
    timed("hiit", "HIIT"),
    timed("stair-climber", "Stair climber"),
  ],

  exerciseMuscleGroups: [
    // Push
    { exerciseId: "pec-fly", muscleGroupId: "chest" },
    { exerciseId: "sm-incline-bench-press", muscleGroupId: "chest" },
    { exerciseId: "bench-press-flat", muscleGroupId: "chest" },
    { exerciseId: "lateral-raise", muscleGroupId: "shoulders" },
    { exerciseId: "shoulder-press", muscleGroupId: "shoulders" },
    { exerciseId: "rear-delt-fly", muscleGroupId: "shoulders" },
    { exerciseId: "tricep-pushdown", muscleGroupId: "triceps" },
    { exerciseId: "tricep-overhead-extension", muscleGroupId: "triceps" },
    { exerciseId: "single-arm-tricep-pushdown", muscleGroupId: "triceps" },

    // Pull
    { exerciseId: "lat-pulldown", muscleGroupId: "lats" },
    { exerciseId: "cable-pull-up", muscleGroupId: "lats" },
    { exerciseId: "seated-row-vertical", muscleGroupId: "lats" },
    { exerciseId: "seated-row-horizontal", muscleGroupId: "mid-back" },
    { exerciseId: "machine-preacher-curl", muscleGroupId: "biceps" },
    { exerciseId: "incline-bench-curl", muscleGroupId: "biceps" },
    { exerciseId: "reverse-curl", muscleGroupId: "biceps" },
    { exerciseId: "hammer-curl", muscleGroupId: "forearms" },
    { exerciseId: "cable-forearm-curl", muscleGroupId: "forearms" },

    // Legs
    { exerciseId: "quad-extension", muscleGroupId: "quads" },
    { exerciseId: "hip-adduction", muscleGroupId: "quads" },
    { exerciseId: "hamstring-curl", muscleGroupId: "hamstrings" },
    { exerciseId: "calf-raise", muscleGroupId: "calves" },
    { exerciseId: "hip-abduction", muscleGroupId: "glutes" },
    { exerciseId: "hip-thrust", muscleGroupId: "glutes" },
    { exerciseId: "hack-squat", muscleGroupId: "whole-leg" },
    { exerciseId: "leg-press", muscleGroupId: "whole-leg" },
    { exerciseId: "squat", muscleGroupId: "whole-leg" },

    // Abs
    { exerciseId: "decline-sit-up", muscleGroupId: "lower-abs" },
    { exerciseId: "cable-crunch", muscleGroupId: "upper-abs" },
    { exerciseId: "cable-woodchop", muscleGroupId: "obliques" },

    // Cardio — all under the implicit group
    { exerciseId: "swimming", muscleGroupId: "cardio-all" },
    { exerciseId: "running", muscleGroupId: "cardio-all" },
    { exerciseId: "cycling", muscleGroupId: "cardio-all" },
    { exerciseId: "rowing", muscleGroupId: "cardio-all" },
    { exerciseId: "hiit", muscleGroupId: "cardio-all" },
    { exerciseId: "stair-climber", muscleGroupId: "cardio-all" },

    // No exercise currently serves more than one muscle group. The model
    // supports it and the completion rule depends on it, so it is pinned by a
    // test rather than left to rot (Q26, #3).
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
    minimumSets: SETS,
  };
}

/** Rowing, HIIT, stair climber — recorded in seconds (D12). */
function timed(id: string, name: string) {
  return {
    id,
    name,
    aliases: [] as string[],
    tracking: "duration" as const,
    weightIncrementKg: 0,
    defaultRestSeconds: 0,
    // Ignored while tracking is not weightReps, but left at the default so
    // switching an exercise over later does not silently weaken the rule.
    minimumSets: SETS,
  };
}

/** Swimming, running, cycling — recorded in metres, displayed as km (D12). */
function distance(id: string, name: string) {
  return {
    id,
    name,
    aliases: [] as string[],
    tracking: "distance" as const,
    weightIncrementKg: 0,
    defaultRestSeconds: 0,
    // Ignored while tracking is not weightReps, but left at the default so
    // switching an exercise over later does not silently weaken the rule.
    minimumSets: SETS,
  };
}
