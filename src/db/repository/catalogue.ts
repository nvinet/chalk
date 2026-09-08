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

import type { Id, Exercise, MuscleGroup } from '../../domain/types';
import { db } from '../client';
import { toFamily, toExercise, toMuscleGroup } from '../mappers';
import {
  families,
  familyMuscleGroups,
  exerciseMuscleGroups,
  exercises,
  muscleGroups,
} from '../schema';

/** A muscle group as it appears inside one family, with that family's count. */
export interface FamilyMuscleGroupView {
  group: MuscleGroup;
  /** 0 means optional: shown in the session, never blocking. */
  requiredExerciseCount: number;
}

/** An exercise as it appears under one muscle group, with how it is used there. */
export interface MuscleGroupExerciseView {
  exercise: Exercise;
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
 * exercises it requires *in this family* — the count is per group per family,
 * so chest can require two on push day and something else elsewhere.
 *
 * Implicit groups are returned. Abs and cardio are modelled with one, and the
 * completion rule needs it; it is the UI's job never to show it.
 */
export function muscleGroupsForFamily(familyId: Id): FamilyMuscleGroupView[] {
  return db
    .select({ group: muscleGroups, required: familyMuscleGroups.requiredExerciseCount })
    .from(familyMuscleGroups)
    .innerJoin(muscleGroups, eq(muscleGroups.id, familyMuscleGroups.muscleGroupId))
    .where(
      and(eq(familyMuscleGroups.familyId, familyId), eq(muscleGroups.archived, false)),
    )
    .orderBy(asc(familyMuscleGroups.position))
    .all()
    .map((row) => ({
      group: toMuscleGroup(row.group),
      requiredExerciseCount: row.required,
    }));
}

/**
 * The exercises mapped to a muscle group — the list behind W3.
 *
 * The mapping says what an exercise counts towards and grants no credit on
 * its own; credit comes from a set naming the group.
 */
export function exercisesForMuscleGroup(muscleGroupId: Id): MuscleGroupExerciseView[] {
  return db
    .select({ exercise: exercises })
    .from(exerciseMuscleGroups)
    .innerJoin(exercises, eq(exercises.id, exerciseMuscleGroups.exerciseId))
    .where(
      and(
        eq(exerciseMuscleGroups.muscleGroupId, muscleGroupId),
        eq(exercises.archived, false),
      ),
    )
    .orderBy(asc(exerciseMuscleGroups.position), asc(exercises.name))
    .all()
    .map((row) => ({ exercise: toExercise(row.exercise) }));
}

/** One exercise, or null. Archived exercises are still returned: history needs them. */
export function exerciseById(id: Id): Exercise | null {
  const row = db.select().from(exercises).where(eq(exercises.id, id)).get();
  return row ? toExercise(row) : null;
}

/** Every exercise, archived included — scoring a past session needs them all. */
export function listExercises(): Exercise[] {
  return db.select().from(exercises).all().map(toExercise);
}

/** Every muscle group, for looking up names by id. */
export function listMuscleGroups(): MuscleGroup[] {
  return db.select().from(muscleGroups).all().map(toMuscleGroup);
}
