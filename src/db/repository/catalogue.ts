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

import { and, asc, count, desc, eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import type { Exercise, Family, Id, MuscleGroup } from '../../domain/types';
import { db } from '../client';
import { newId } from '../ids';
import { toFamily, toExercise, toMuscleGroup } from '../mappers';
import {
  exerciseMuscleGroups,
  exercises,
  families,
  familyMuscleGroups,
  muscleGroups,
  sessionRequirements,
  setEntries,
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

/* ------------------------------------------------------------------ writes */

/**
 * Whether anything logged refers to this row.
 *
 * Decides archive versus delete. The foreign keys from set_entries and
 * session_requirements restrict rather than cascade, so deleting something
 * history mentions would fail at the database anyway — this asks first, so the
 * screen can explain instead of showing a constraint error.
 */
export interface Usage {
  sets: number;
  sessions: number;
}

export function muscleGroupUsage(id: Id): Usage {
  return {
    sets:
      db
        .select({ n: count() })
        .from(setEntries)
        .where(eq(setEntries.muscleGroupId, id))
        .get()?.n ?? 0,
    sessions:
      db
        .select({ n: count() })
        .from(sessionRequirements)
        .where(eq(sessionRequirements.muscleGroupId, id))
        .get()?.n ?? 0,
  };
}

export function exerciseUsage(id: Id): Usage {
  return {
    sets:
      db.select({ n: count() }).from(setEntries).where(eq(setEntries.exerciseId, id)).get()
        ?.n ?? 0,
    sessions: 0,
  };
}

export function isUsed(usage: Usage): boolean {
  return usage.sets > 0 || usage.sessions > 0;
}

/**
 * Adds a muscle group and puts it in a family.
 *
 * A group outside every family can never be trained, so the two are one action
 * rather than two — there is no useful intermediate state to leave him in.
 */
export function createMuscleGroup(name: string, familyId: Id): Id {
  const id = newId('group');

  db.transaction((tx) => {
    const lastPosition =
      tx
        .select({ position: muscleGroups.position })
        .from(muscleGroups)
        .orderBy(desc(muscleGroups.position))
        .get()?.position ?? 0;

    tx.insert(muscleGroups)
      .values({ id, name: name.trim(), position: lastPosition + 1 })
      .run();

    const lastInFamily =
      tx
        .select({ position: familyMuscleGroups.position })
        .from(familyMuscleGroups)
        .where(eq(familyMuscleGroups.familyId, familyId))
        .orderBy(desc(familyMuscleGroups.position))
        .get()?.position ?? 0;

    tx.insert(familyMuscleGroups)
      .values({
        familyId,
        muscleGroupId: id,
        position: lastInFamily + 1,
        requiredExerciseCount: 1,
      })
      .run();
  });

  return id;
}

export function renameMuscleGroup(id: Id, name: string): void {
  db.update(muscleGroups).set({ name: name.trim() }).where(eq(muscleGroups.id, id)).run();
}

/**
 * Archiving keeps the row, so history that refers to it still resolves. A past
 * session reads exactly the same afterwards.
 */
export function setMuscleGroupArchived(id: Id, archived: boolean): void {
  db.update(muscleGroups).set({ archived }).where(eq(muscleGroups.id, id)).run();
}

/** Only ever call this when `isUsed` is false; the foreign keys refuse otherwise. */
export function deleteMuscleGroup(id: Id): void {
  db.transaction((tx) => {
    tx.delete(exerciseMuscleGroups)
      .where(eq(exerciseMuscleGroups.muscleGroupId, id))
      .run();
    tx.delete(familyMuscleGroups).where(eq(familyMuscleGroups.muscleGroupId, id)).run();
    tx.delete(muscleGroups).where(eq(muscleGroups.id, id)).run();
  });
}

/** Writes the given order as positions, so a drag or a move survives a reload. */
export function reorderMuscleGroups(idsInOrder: Id[]): void {
  db.transaction((tx) => {
    idsInOrder.forEach((id, index) => {
      tx.update(muscleGroups)
        .set({ position: index + 1 })
        .where(eq(muscleGroups.id, id))
        .run();
    });
  });
}

/** Which family a group belongs to, if any. A group can only be in one. */
export function familyOfMuscleGroup(id: Id): Family | null {
  const row = db
    .select({ family: families })
    .from(familyMuscleGroups)
    .innerJoin(families, eq(families.id, familyMuscleGroups.familyId))
    .where(eq(familyMuscleGroups.muscleGroupId, id))
    .get();
  return row ? toFamily(row.family) : null;
}

/**
 * Muscle groups, kept live.
 *
 * The editor writes through this same connection, so SQLite's update hook
 * fires and the list re-reads itself. Without it the screen would need a
 * counter bumped by hand after every edit, which is a dependency the linter
 * rightly cannot see the point of.
 */
export function useMuscleGroups(): MuscleGroup[] {
  const live = useLiveQuery(db.select().from(muscleGroups).orderBy(asc(muscleGroups.position)));
  return useMemo(() => (live.data ?? []).map(toMuscleGroup), [live.data]);
}

/* -------------------------------------------------- family composition (#15) */

/**
 * How many distinct exercises this group needs, in this family.
 *
 * Per group per family, so chest can ask for two on push day and something
 * else elsewhere. Changing it never touches a session already logged:
 * requirements are snapshotted when a session starts (#19), and nothing reads
 * this table to score the past.
 */
export function setRequiredExerciseCount(
  familyId: Id,
  muscleGroupId: Id,
  required: number,
): void {
  db.update(familyMuscleGroups)
    .set({ requiredExerciseCount: Math.max(0, Math.round(required)) })
    .where(
      and(
        eq(familyMuscleGroups.familyId, familyId),
        eq(familyMuscleGroups.muscleGroupId, muscleGroupId),
      ),
    )
    .run();
}

export function reorderFamilyMuscleGroups(familyId: Id, idsInOrder: Id[]): void {
  db.transaction((tx) => {
    idsInOrder.forEach((muscleGroupId, index) => {
      tx.update(familyMuscleGroups)
        .set({ position: index + 1 })
        .where(
          and(
            eq(familyMuscleGroups.familyId, familyId),
            eq(familyMuscleGroups.muscleGroupId, muscleGroupId),
          ),
        )
        .run();
    });
  });
}

/* ------------------------------------------------------ exercises (#16) */

/**
 * A new exercise, attached to nothing.
 *
 * The muscle groups are chosen on the editor that opens straight after, and
 * guessing one here would be worse than none: an exercise silently filed under
 * chest is harder to notice than one the editor flags as attached to nothing.
 */
export function createExercise(name: string, muscleGroupId?: Id): Id {
  const id = newId('exercise');
  db.transaction((tx) => {
    tx.insert(exercises).values({ id, name: name.trim(), aliases: [] }).run();
    if (muscleGroupId) {
      tx.insert(exerciseMuscleGroups).values({ exerciseId: id, muscleGroupId, position: 0 }).run();
    }
  });
  return id;
}

export interface ExerciseFields {
  name?: string;
  tracking?: Exercise['tracking'];
  weightIncrementKg?: number;
  defaultRestSeconds?: number;
  minimumSets?: number;
  aliases?: string[];
}

export function updateExercise(id: Id, fields: ExerciseFields): void {
  db.update(exercises).set(fields).where(eq(exercises.id, id)).run();
}

export function setExerciseArchived(id: Id, archived: boolean): void {
  db.update(exercises).set({ archived }).where(eq(exercises.id, id)).run();
}

/** Only when `isUsed` is false; the foreign keys refuse otherwise. */
export function deleteExercise(id: Id): void {
  db.transaction((tx) => {
    tx.delete(exerciseMuscleGroups).where(eq(exerciseMuscleGroups.exerciseId, id)).run();
    tx.delete(exercises).where(eq(exercises.id, id)).run();
  });
}

/**
 * Replaces which groups an exercise counts towards.
 *
 * The mapping says what is *possible*; it grants no credit on its own, so
 * removing one never rewrites a set that already named that group (D4).
 */
export function setExerciseMuscleGroups(exerciseId: Id, muscleGroupIds: Id[]): void {
  db.transaction((tx) => {
    tx.delete(exerciseMuscleGroups).where(eq(exerciseMuscleGroups.exerciseId, exerciseId)).run();
    if (muscleGroupIds.length === 0) return;
    tx.insert(exerciseMuscleGroups)
      .values(muscleGroupIds.map((muscleGroupId, i) => ({ exerciseId, muscleGroupId, position: i })))
      .run();
  });
}

/** The groups an exercise counts towards. */
export function muscleGroupsForExercise(exerciseId: Id): Id[] {
  return db
    .select({ id: exerciseMuscleGroups.muscleGroupId })
    .from(exerciseMuscleGroups)
    .where(eq(exerciseMuscleGroups.exerciseId, exerciseId))
    .all()
    .map((r) => r.id);
}

/** Every exercise, live, for the library list. */
export function useExercises(): Exercise[] {
  const live = useLiveQuery(db.select().from(exercises).orderBy(asc(exercises.name)));
  return useMemo(() => (live.data ?? []).map(toExercise), [live.data]);
}
