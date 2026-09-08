/**
 * Session reads and writes.
 *
 * The counterpart to `catalogue.ts`: that file holds what exists to be trained,
 * this one holds what actually happened. Sessions reference the catalogue and
 * are referenced by nothing.
 */

import { and, asc, desc, eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import type { Id, IsoDate, Session } from '../../domain/types';
import { db } from '../client';
import { newId, today } from '../ids';
import { toSession, toSetEntry } from '../mappers';
import {
  familyMuscleGroups,
  muscleGroups,
  sessionRequirements,
  sessions,
  setEntries,
} from '../schema';

/**
 * Starts a session for a family, copying the family's current required counts
 * onto the session.
 *
 * The copy is the whole point. Requirements are read once, here, and never
 * read again — so raising chest from one exercise to two in November cannot
 * retrospectively fail a session logged in August. Everything that scores a
 * session reads `session_requirements`, never `family_muscle_groups`.
 *
 * Implicit groups are copied too. Cardio is scored through one, and hiding it
 * is the UI's job, not the scorer's.
 */
export function startSession(familyId: Id, date: IsoDate = today()): Session {
  const id = newId('session');

  return db.transaction((tx) => {
    const snapshot = tx
      .select({
        muscleGroupId: familyMuscleGroups.muscleGroupId,
        position: familyMuscleGroups.position,
        requiredExerciseCount: familyMuscleGroups.requiredExerciseCount,
      })
      .from(familyMuscleGroups)
      .innerJoin(muscleGroups, eq(muscleGroups.id, familyMuscleGroups.muscleGroupId))
      .where(
        and(eq(familyMuscleGroups.familyId, familyId), eq(muscleGroups.archived, false)),
      )
      .orderBy(asc(familyMuscleGroups.position))
      .all();

    if (snapshot.length === 0) {
      throw new Error(`family ${familyId} has no muscle groups to score`);
    }

    tx.insert(sessions).values({ id, familyId, date, status: 'inProgress' }).run();

    tx.insert(sessionRequirements)
      .values(
        snapshot.map((r) => ({
          sessionId: id,
          muscleGroupId: r.muscleGroupId,
          position: r.position,
          requiredExerciseCount: r.requiredExerciseCount,
        })),
      )
      .run();

    const row = tx.select().from(sessions).where(eq(sessions.id, id)).get();
    if (!row) throw new Error('session vanished immediately after insert');

    return toSession(
      row,
      snapshot.map((r) => ({
        muscleGroupId: r.muscleGroupId,
        requiredExerciseCount: r.requiredExerciseCount,
      })),
      [],
    );
  });
}

/** One session with its snapshotted requirements and every set logged against it. */
export function getSession(id: Id): Session | null {
  const row = db.select().from(sessions).where(eq(sessions.id, id)).get();
  if (!row) return null;

  const requirements = db
    .select()
    .from(sessionRequirements)
    .where(eq(sessionRequirements.sessionId, id))
    .orderBy(asc(sessionRequirements.position))
    .all()
    .map((r) => ({
      muscleGroupId: r.muscleGroupId,
      requiredExerciseCount: r.requiredExerciseCount,
    }));

  const sets = db
    .select()
    .from(setEntries)
    .where(eq(setEntries.sessionId, id))
    .orderBy(asc(setEntries.createdAt))
    .all()
    .map(toSetEntry);

  return toSession(row, requirements, sets);
}

/**
 * The session still in progress, if there is one.
 *
 * This is what makes an interrupted session resumable (#23): nothing is held in
 * memory, so reopening the app finds the session exactly as the last write left
 * it.
 */
export function activeSession(): Session | null {
  const row = db
    .select({ id: sessions.id })
    .from(sessions)
    .where(eq(sessions.status, 'inProgress'))
    .orderBy(desc(sessions.startedAt))
    .get();

  return row ? getSession(row.id) : null;
}

/** Marks a session finished. Finishing is always allowed, however little was logged. */
export function finishSession(id: Id): Session | null {
  db.update(sessions)
    .set({ status: 'finished', finishedAt: new Date().toISOString() })
    .where(eq(sessions.id, id))
    .run();
  return getSession(id);
}

/** Abandons a session — closed without claiming it happened. */
export function abandonSession(id: Id): void {
  db.update(sessions)
    .set({ status: 'abandoned', finishedAt: new Date().toISOString() })
    .where(eq(sessions.id, id))
    .run();
}

/**
 * A session whose sets stay live while its shell is read once.
 *
 * The split mirrors the data. Requirements are snapshotted at start and are
 * immutable by design (#19), and the session row does not change while it is
 * being logged — so both are read once. Sets change constantly, so they come
 * from `useLiveQuery`, which is what `enableChangeListener: true` in
 * `client.ts` was enabled for back in #10: SQLite fires an update hook, the
 * query re-runs, and the screen re-renders.
 *
 * Without this a session screen reads once and goes stale the moment a set is
 * logged — which is exactly the thing it exists to show.
 */
export function useSession(id: Id): Session | null {
  const live = useLiveQuery(
    db
      .select()
      .from(setEntries)
      .where(eq(setEntries.sessionId, id))
      .orderBy(asc(setEntries.createdAt)),
  );

  const shell = useMemo(() => {
    const row = db.select().from(sessions).where(eq(sessions.id, id)).get();
    if (!row) return null;

    const requirements = db
      .select()
      .from(sessionRequirements)
      .where(eq(sessionRequirements.sessionId, id))
      .orderBy(asc(sessionRequirements.position))
      .all()
      .map((r) => ({
        muscleGroupId: r.muscleGroupId,
        requiredExerciseCount: r.requiredExerciseCount,
      }));

    return { row, requirements };
  }, [id]);

  if (!shell) return null;
  return toSession(shell.row, shell.requirements, (live.data ?? []).map(toSetEntry));
}
