import { count } from 'drizzle-orm';

import type { Catalogue } from '../domain/types';
import { db } from './client';
import {
  exerciseMuscleGroups,
  exercises,
  familyMuscleGroups,
  families,
  muscleGroups,
} from './schema';
import { seedCatalogue } from './seed';

/**
 * Loads the catalogue into the database.
 *
 * Safe to run on every launch. Every insert is `onConflictDoNothing`, so an
 * existing row is left exactly as it is — this can add what is missing but can
 * never overwrite an edit he has made, and can never duplicate.
 *
 * That also means a later release can add exercises to `seed.ts` and they will
 * appear without a migration. It will not resurrect something he archived,
 * because archiving leaves the row in place for the conflict to catch.
 *
 * Order matters: parents before the rows that reference them, or the foreign
 * keys reject the insert.
 *
 * Must run *after* migrations. The tables do not exist until then.
 */
export function applyCatalogueSeed(catalogue: Catalogue = seedCatalogue): void {
  db.transaction((tx) => {
    if (catalogue.families.length) {
      tx.insert(families)
        .values(
          catalogue.families.map((f) => ({
            id: f.id,
            name: f.name,
            position: f.position,
            usesMuscleGroups: f.usesMuscleGroups,
          })),
        )
        .onConflictDoNothing()
        .run();
    }

    if (catalogue.muscleGroups.length) {
      tx.insert(muscleGroups)
        .values(
          catalogue.muscleGroups.map((g) => ({
            id: g.id,
            name: g.name,
            position: g.position,
            implicit: g.implicit ?? false,
            archived: g.archived ?? false,
          })),
        )
        .onConflictDoNothing()
        .run();
    }

    if (catalogue.familyMuscleGroups.length) {
      tx.insert(familyMuscleGroups)
        .values(
          catalogue.familyMuscleGroups.map((fmg) => ({
            familyId: fmg.familyId,
            muscleGroupId: fmg.muscleGroupId,
            position: fmg.position,
            requiredExerciseCount: fmg.requiredExerciseCount,
          })),
        )
        .onConflictDoNothing()
        .run();
    }

    if (catalogue.exercises.length) {
      tx.insert(exercises)
        .values(
          catalogue.exercises.map((e) => ({
            id: e.id,
            name: e.name,
            aliases: e.aliases,
            tracking: e.tracking,
            weightIncrementKg: e.weightIncrementKg,
            defaultRestSeconds: e.defaultRestSeconds,
            minimumSets: e.minimumSets,
            archived: e.archived ?? false,
          })),
        )
        .onConflictDoNothing()
        .run();
    }

    if (catalogue.exerciseMuscleGroups.length) {
      tx.insert(exerciseMuscleGroups)
        .values(
          catalogue.exerciseMuscleGroups.map((m, i) => ({
            exerciseId: m.exerciseId,
            muscleGroupId: m.muscleGroupId,
            position: i,
          })),
        )
        .onConflictDoNothing()
        .run();
    }
  });
}

export interface CatalogueCounts {
  families: number;
  muscleGroups: number;
  exercises: number;
}

/** What is actually in the database. Used to prove the seed landed. */
export function catalogueCounts(): CatalogueCounts {
  return {
    families: db.select({ n: count() }).from(families).get()?.n ?? 0,
    muscleGroups: db.select({ n: count() }).from(muscleGroups).get()?.n ?? 0,
    exercises: db.select({ n: count() }).from(exercises).get()?.n ?? 0,
  };
}
