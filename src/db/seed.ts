/**
 * Chalk — seed catalogue.
 *
 * The taxonomy from Appendix B of the project plan, v0.2. This is a proposal
 * and is expected to be corrected before M1 is signed off (Q25, Q26, Q27):
 * rear delt row's group, the hammer curl mapping, whether hips should be two
 * groups, and what belongs under abs and cardio (Q28).
 *
 * Machines are physical objects, so the Smith machine and the cable station
 * each appear once and are mapped to several muscle groups across families.
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
    { familyId: "push", muscleGroupId: "chest", position: 1, requiredMachineCount: 1 },
    { familyId: "push", muscleGroupId: "shoulders", position: 2, requiredMachineCount: 1 },
    { familyId: "push", muscleGroupId: "triceps", position: 3, requiredMachineCount: 1 },

    { familyId: "pull", muscleGroupId: "back", position: 1, requiredMachineCount: 1 },
    { familyId: "pull", muscleGroupId: "biceps", position: 2, requiredMachineCount: 1 },
    // Forearms failed all three historical pull sessions on a count of 1 —
    // it has one machine and was skipped both times it appeared (§3.4).
    // Shipped optional; he can raise it once he decides (Q27).
    { familyId: "pull", muscleGroupId: "forearms", position: 3, requiredMachineCount: 0 },

    { familyId: "legs", muscleGroupId: "quads", position: 1, requiredMachineCount: 1 },
    { familyId: "legs", muscleGroupId: "hamstrings", position: 2, requiredMachineCount: 1 },
    { familyId: "legs", muscleGroupId: "calves", position: 3, requiredMachineCount: 1 },
    { familyId: "legs", muscleGroupId: "hips", position: 4, requiredMachineCount: 1 },

    { familyId: "abs", muscleGroupId: "abs-all", position: 1, requiredMachineCount: 1 },
    { familyId: "cardio", muscleGroupId: "cardio-all", position: 1, requiredMachineCount: 1 },
  ],

  machines: [
    lift("pec-fly", "Pec fly", ["peck fly"]),
    lift("smith-machine", "Smith machine", ["SM incline bench press"]),
    lift("bench-press-flat", "Bench press (flat)", []),
    lift("lateral-raise", "Lateral raise", ["lateral rases"], 1),
    lift("shoulder-press", "Shoulder press", []),
    lift("rear-delt-row", "Rear delt row", [], 1),
    lift("cable-station", "Cable station", ["trycept pushdown", "cable pull up", "cable forearm curl"]),
    lift("tricep-overhead-extension", "Tricep overhead extension", ["trycept overhead extension"], 1),
    lift("lat-pulldown", "Lat pulldown", ["lat pull down"]),
    lift("seated-row-horizontal", "Seated row (horizontal)", []),
    lift("seated-row-vertical", "Seated row (vertical)", []),
    lift("t-bar-row", "T-bar row", []),
    lift("machine-preacher-curl", "Machine preacher curl", [], 1),
    lift("incline-bench-curl", "Incline bench bicep curl", ["incline bench bycept curl"], 1),
    lift("hammer-curl", "Hammer curl", [], 1),
    lift("hack-squat", "Hack squat", ["hax squat"]),
    lift("quad-extension", "Quad extension", ["quad extention"]),
    lift("hamstring-curl", "Hamstring curl", []),
    lift("calf-raise", "Calf raise", ["calve rases"]),
    lift("hip-abduction", "Hip abduction", ["hip abductor"]),
    lift("hip-adduction", "Hip adduction", ["hip adductor"]),
  ],

  machineMuscleGroups: [
    // Push
    { machineId: "pec-fly", muscleGroupId: "chest" },
    { machineId: "smith-machine", muscleGroupId: "chest", variant: "incline press" },
    { machineId: "smith-machine", muscleGroupId: "shoulders", variant: "shoulder press" },
    { machineId: "smith-machine", muscleGroupId: "quads", variant: "squat" },
    { machineId: "bench-press-flat", muscleGroupId: "chest" },
    { machineId: "bench-press-flat", muscleGroupId: "triceps", variant: "close grip" },
    { machineId: "lateral-raise", muscleGroupId: "shoulders" },
    { machineId: "shoulder-press", muscleGroupId: "shoulders" },
    { machineId: "rear-delt-row", muscleGroupId: "shoulders" },
    { machineId: "cable-station", muscleGroupId: "triceps", variant: "pushdown" },
    { machineId: "tricep-overhead-extension", muscleGroupId: "triceps" },

    // Pull
    { machineId: "lat-pulldown", muscleGroupId: "back" },
    { machineId: "cable-station", muscleGroupId: "back", variant: "pull-up" },
    { machineId: "cable-station", muscleGroupId: "forearms", variant: "forearm curl" },
    { machineId: "seated-row-horizontal", muscleGroupId: "back" },
    { machineId: "seated-row-vertical", muscleGroupId: "back" },
    { machineId: "t-bar-row", muscleGroupId: "back" },
    { machineId: "machine-preacher-curl", muscleGroupId: "biceps" },
    { machineId: "incline-bench-curl", muscleGroupId: "biceps" },
    { machineId: "hammer-curl", muscleGroupId: "biceps" },
    { machineId: "hammer-curl", muscleGroupId: "forearms" },

    // Legs
    { machineId: "hack-squat", muscleGroupId: "quads" },
    { machineId: "quad-extension", muscleGroupId: "quads" },
    { machineId: "hamstring-curl", muscleGroupId: "hamstrings" },
    { machineId: "calf-raise", muscleGroupId: "calves" },
    { machineId: "hip-abduction", muscleGroupId: "hips" },
    { machineId: "hip-adduction", muscleGroupId: "hips" },

    // Abs and cardio have no machines yet — Q28.
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

/** For when Q28 is answered: cardio machines record time, not weight. */
export function timedMachine(id: string, name: string) {
  return {
    id,
    name,
    aliases: [] as string[],
    tracking: "duration" as const,
    weightIncrementKg: 0,
    defaultRestSeconds: 0,
  };
}
