/**
 * Catalogue queries.
 *
 * Thin by design: every function returns domain types, never Drizzle rows, so
 * the layers above never learn what a column is called. Mapping happens in
 * `mappers.ts`.
 *
 * All of it is synchronous. The Expo driver is a sync dialect, which is what
 * lets a screen read the catalogue during render and what makes `useLiveQuery`
 * possible — and it means logging a set never waits on a promise.
 */

import { and, asc, eq } from 'drizzle-orm';

import type { Id, Machine, MuscleGroup } from '../../domain/types';
import { db } from '../client';
import { toFamily, toMachine, toMuscleGroup } from '../mappers';
import {
  families,
  familyMuscleGroups,
  machineMuscleGroups,
  machines,
  muscleGroups,
} from '../schema';

/** A muscle group as it appears inside one family, with that family's count. */
export interface FamilyMuscleGroupView {
  group: MuscleGroup;
  /** 0 means optional: shown in the session, never blocking. */
  requiredMachineCount: number;
}

/** A machine as it appears under one muscle group, with how it is used there. */
export interface MuscleGroupMachineView {
  machine: Machine;
  /** "incline press", "squat", "pushdown" — null when the machine has one use. */
  variant: string | null;
}

/** Every family, in display order. Archived families are excluded. */
export function listFamilies() {
  return db
    .select()
    .from(families)
    .where(eq(families.archived, false))
    .orderBy(asc(families.position))
    .all()
    .map(toFamily);
}

/**
 * The muscle groups that make up a family, each with the number of distinct
 * machines it requires *in this family* — the count is per group per family,
 * so chest can require two on push day and something else elsewhere.
 *
 * Implicit groups are returned. Abs and cardio are modelled with one, and the
 * completion rule needs it; it is the UI's job never to show it.
 */
export function muscleGroupsForFamily(familyId: Id): FamilyMuscleGroupView[] {
  return db
    .select({ group: muscleGroups, required: familyMuscleGroups.requiredMachineCount })
    .from(familyMuscleGroups)
    .innerJoin(muscleGroups, eq(muscleGroups.id, familyMuscleGroups.muscleGroupId))
    .where(
      and(eq(familyMuscleGroups.familyId, familyId), eq(muscleGroups.archived, false)),
    )
    .orderBy(asc(familyMuscleGroups.position))
    .all()
    .map((row) => ({
      group: toMuscleGroup(row.group),
      requiredMachineCount: row.required,
    }));
}

/**
 * The machines mapped to a muscle group — the list behind W3.
 *
 * The mapping says what a machine *may* be used for and grants no credit on
 * its own; credit comes from a set naming the group.
 */
export function machinesForMuscleGroup(muscleGroupId: Id): MuscleGroupMachineView[] {
  return db
    .select({ machine: machines, variant: machineMuscleGroups.variant })
    .from(machineMuscleGroups)
    .innerJoin(machines, eq(machines.id, machineMuscleGroups.machineId))
    .where(
      and(
        eq(machineMuscleGroups.muscleGroupId, muscleGroupId),
        eq(machines.archived, false),
      ),
    )
    .orderBy(asc(machineMuscleGroups.position), asc(machines.name))
    .all()
    .map((row) => ({ machine: toMachine(row.machine), variant: row.variant }));
}

/** One machine, or null. Archived machines are still returned: history needs them. */
export function machineById(id: Id): Machine | null {
  const row = db.select().from(machines).where(eq(machines.id, id)).get();
  return row ? toMachine(row) : null;
}
