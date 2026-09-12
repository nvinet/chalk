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

import type { Id, IsoDate, Session, SetEntry, SkipReason } from '../../domain/types';
import { db } from '../client';
import { newId, today } from '../ids';
import { toSession, toSetEntry, toSkipReason } from '../mappers';
import {
  familyMuscleGroups,
  muscleGroups,
  sessionExerciseNotes,
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
 *
 * Throws if a session is already in progress (#58). A partial unique index
 * enforces that too, so a caller that forgets this check still cannot create a
 * second one — but a constraint violation explains nothing, and this is the
 * normal path.
 */
export function startSession(familyId: Id, date: IsoDate = today()): Session {
  const open = activeSession();
  if (open) {
    throw new Error(
      `a ${open.familyId} session from ${open.date} is still in progress — finish or abandon it first`,
    );
  }

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
      skipped: r.skipped,
      skipReason: toSkipReason(r.skipReason),
    }));

  const sets = db
    .select()
    .from(setEntries)
    .where(eq(setEntries.sessionId, id))
    .orderBy(asc(setEntries.createdAt))
    .all()
    .map(toSetEntry);

  const exerciseNotes = db
    .select()
    .from(sessionExerciseNotes)
    .where(eq(sessionExerciseNotes.sessionId, id))
    .all()
    .map((r) => ({
      exerciseId: r.exerciseId,
      muscleGroupId: r.muscleGroupId,
      note: r.note,
    }));

  return toSession(row, requirements, sets, exerciseNotes);
}

/**
 * Writes, or clears, the note for one exercise in one session (#66).
 *
 * Saved as it is typed, like the sets themselves and like the session note —
 * the app being killed mid-session must never be the reason something written
 * down is gone (N7).
 *
 * An empty note deletes the row rather than storing a blank one, so "no note"
 * has one representation instead of two.
 */
export function setSessionExerciseNote(
  sessionId: Id,
  exerciseId: Id,
  muscleGroupId: Id,
  note: string,
): void {
  const trimmed = note.trim();
  if (trimmed === '') {
    db.delete(sessionExerciseNotes)
      .where(
        and(
          eq(sessionExerciseNotes.sessionId, sessionId),
          eq(sessionExerciseNotes.exerciseId, exerciseId),
          eq(sessionExerciseNotes.muscleGroupId, muscleGroupId),
        ),
      )
      .run();
    return;
  }

  db.insert(sessionExerciseNotes)
    .values({ sessionId, exerciseId, muscleGroupId, note: trimmed })
    .onConflictDoUpdate({
      target: [
        sessionExerciseNotes.sessionId,
        sessionExerciseNotes.exerciseId,
        sessionExerciseNotes.muscleGroupId,
      ],
      set: { note: trimmed },
    })
    .run();
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
        skipped: r.skipped,
        skipReason: toSkipReason(r.skipReason),
      }));

    return { row, requirements };
  }, [id]);

  if (!shell) return null;
  return toSession(shell.row, shell.requirements, (live.data ?? []).map(toSetEntry));
}

/**
 * Recent sessions containing work for a muscle group, most recent first.
 *
 * Feeds "last time" on W3. Deliberately scoped to the group rather than to a
 * single exercise: the screen asks about every exercise mapped to the group, so
 * one query beats one per row.
 *
 * `exclude` keeps the session in progress out of its own history — "last time"
 * means before today, not what was logged five minutes ago.
 */
/**
 * Every session containing a set for one pairing, oldest query first — no
 * window (#67).
 *
 * `recentSessionsForMuscleGroup` caps at 20 sessions, which is right for "last
 * time" and wrong for a personal best: a best computed over a window silently
 * forgets older lifts, and a beaten record would reappear as sessions aged out
 * of it. A personal best is over everything or it is not personal.
 */
export function sessionsForPairing(
  exerciseId: Id,
  muscleGroupId: Id,
  exclude?: Id,
): Session[] {
  const ids = db
    .selectDistinct({ sessionId: setEntries.sessionId, date: sessions.date })
    .from(setEntries)
    .innerJoin(sessions, eq(sessions.id, setEntries.sessionId))
    .where(
      and(
        eq(setEntries.exerciseId, exerciseId),
        eq(setEntries.muscleGroupId, muscleGroupId),
      ),
    )
    .orderBy(desc(sessions.date))
    .all()
    .map((r) => r.sessionId)
    .filter((sessionId) => sessionId !== exclude);

  return ids.flatMap((sessionId) => {
    const session = getSession(sessionId);
    return session ? [session] : [];
  });
}

export function recentSessionsForMuscleGroup(
  muscleGroupId: Id,
  exclude?: Id,
  limit = 20,
): Session[] {
  const ids = db
    .selectDistinct({ sessionId: setEntries.sessionId, date: sessions.date })
    .from(setEntries)
    .innerJoin(sessions, eq(sessions.id, setEntries.sessionId))
    .where(eq(setEntries.muscleGroupId, muscleGroupId))
    .orderBy(desc(sessions.date))
    .limit(limit)
    .all()
    .map((r) => r.sessionId)
    .filter((sessionId) => sessionId !== exclude);

  return ids.flatMap((sessionId) => {
    const session = getSession(sessionId);
    return session ? [session] : [];
  });
}

/** What a set records, before it knows its number. */
export interface SetInput {
  skipped?: boolean;
  skipReason?: SkipReason | null;
  reps?: number | null;
  weightKg?: number | null;
  durationSeconds?: number | null;
  distanceM?: number | null;
  warmup?: boolean;
  note?: string | null;
}

/**
 * Writes one set, immediately.
 *
 * Committed as it is entered, never batched at the end of a session (N7): a
 * crash mid-session must lose nothing. There is no draft state to flush.
 *
 * The set number is derived from what is already logged for this exact pairing
 * in this session, so the same exercise logged for two muscle groups keeps two
 * independent numberings — which is what the unique index on
 * (session, exercise, group, set_number) expects.
 */
export function logSet(
  sessionId: Id,
  exerciseId: Id,
  muscleGroupId: Id,
  input: SetInput,
): SetEntry {
  const existing = db
    .select({ setNumber: setEntries.setNumber })
    .from(setEntries)
    .where(
      and(
        eq(setEntries.sessionId, sessionId),
        eq(setEntries.exerciseId, exerciseId),
        eq(setEntries.muscleGroupId, muscleGroupId),
      ),
    )
    .all();

  const setNumber = existing.reduce((max, r) => Math.max(max, r.setNumber), 0) + 1;
  const id = newId('set');

  db.insert(setEntries)
    .values({
      id,
      sessionId,
      exerciseId,
      muscleGroupId,
      setNumber,
      reps: input.reps ?? null,
      weightKg: input.weightKg ?? null,
      durationSeconds: input.durationSeconds ?? null,
      distanceM: input.distanceM ?? null,
      warmup: input.warmup ?? false,
      skipped: input.skipped ?? false,
      skipReason: input.skipReason ?? null,
      note: input.note ?? null,
    })
    .run();

  const row = db.select().from(setEntries).where(eq(setEntries.id, id)).get();
  if (!row) throw new Error('set vanished immediately after insert');
  return toSetEntry(row);
}

/**
 * Removes a set. Earlier numbers are left alone rather than renumbered —
 * a gap is honest about what happened, and renumbering would rewrite history
 * he did not ask to change.
 */
export function removeSet(id: Id): void {
  db.delete(setEntries).where(eq(setEntries.id, id)).run();
}

/**
 * Whether a session is open, kept live.
 *
 * Drives the screen lock (#29). It watches the sessions table rather than
 * taking a snapshot, so finishing or abandoning releases the lock without the
 * screen that did it having to say so.
 */
export function useHasSessionInProgress(): boolean {
  const live = useLiveQuery(
    db.select({ id: sessions.id }).from(sessions).where(eq(sessions.status, 'inProgress')),
  );
  return (live.data?.length ?? 0) > 0;
}

/**
 * Recent sessions, newest first, whatever their status.
 *
 * Today derives everything from these — the suggestion, the week, the last
 * session — so it is one query rather than several, and the domain does the
 * arithmetic.
 */
export function recentSessions(limit = 60): Session[] {
  return db
    .select({ id: sessions.id })
    .from(sessions)
    .orderBy(desc(sessions.date), desc(sessions.startedAt))
    .limit(limit)
    .all()
    .flatMap((row) => {
      const session = getSession(row.id);
      return session ? [session] : [];
    });
}

/**
 * Recent sessions, kept live.
 *
 * Today derives the suggestion, the week and the last session from these, so it
 * must react when one is started or finished. Watching the sessions table is
 * the honest dependency — a boolean "is training" flag would work as a signal
 * but would read as an accident to anyone maintaining it.
 */
export function useRecentSessions(limit = 60): Session[] {
  const live = useLiveQuery(
    db
      .select({ id: sessions.id })
      .from(sessions)
      .orderBy(desc(sessions.date), desc(sessions.startedAt))
      .limit(limit),
  );

  return useMemo(
    () =>
      (live.data ?? []).flatMap((row) => {
        const session = getSession(row.id);
        return session ? [session] : [];
      }),
    [live.data],
  );
}

/**
 * Records that a muscle group was passed on, and why (#24).
 *
 * Written on the requirement rather than as a set, because it is a fact about
 * the group and not about any exercise. It never satisfies the group: the
 * session still fails, honestly, with a reason attached.
 */
export function skipMuscleGroup(
  sessionId: Id,
  muscleGroupId: Id,
  reason: SkipReason,
): void {
  db.update(sessionRequirements)
    .set({ skipped: true, skipReason: reason })
    .where(
      and(
        eq(sessionRequirements.sessionId, sessionId),
        eq(sessionRequirements.muscleGroupId, muscleGroupId),
      ),
    )
    .run();
}

/** Changed his mind. The group goes back to simply untrained. */
export function unskipMuscleGroup(sessionId: Id, muscleGroupId: Id): void {
  db.update(sessionRequirements)
    .set({ skipped: false, skipReason: null })
    .where(
      and(
        eq(sessionRequirements.sessionId, sessionId),
        eq(sessionRequirements.muscleGroupId, muscleGroupId),
      ),
    )
    .run();
}

/**
 * Records that one exercise was passed on, and why.
 *
 * A skipped set, so it lives with the work it stands in for and shows in the
 * exercise's own history. `isSetLogged` rejects anything skipped, so it can
 * never count towards the group.
 */
export function skipExercise(
  sessionId: Id,
  exerciseId: Id,
  muscleGroupId: Id,
  reason: SkipReason,
): SetEntry {
  return logSet(sessionId, exerciseId, muscleGroupId, {
    skipped: true,
    skipReason: reason,
  });
}

/** Notes are saved as they are typed, like everything else (N7). */
export function setSessionNotes(id: Id, notes: string): void {
  db.update(sessions)
    .set({ notes: notes.trim() === '' ? null : notes })
    .where(eq(sessions.id, id))
    .run();
}

/**
 * Sessions before this one, for judging what is a personal best.
 *
 * Only finished sessions count as history — an abandoned one did not happen,
 * and letting it set a record would make the record a lie.
 */
export function sessionsBefore(id: Id, limit = 200): Session[] {
  const session = getSession(id);
  if (!session) return [];

  return db
    .select({ id: sessions.id })
    .from(sessions)
    .where(eq(sessions.status, 'finished'))
    .orderBy(desc(sessions.date))
    .limit(limit)
    .all()
    .filter((row) => row.id !== id)
    .flatMap((row) => {
      const earlier = getSession(row.id);
      return earlier && earlier.date <= session.date ? [earlier] : [];
    });
}
