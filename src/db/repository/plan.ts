/**
 * The weekly plan and the settings bag (#33).
 *
 * The schedule says what he intends; a session says what he did. Neither is
 * catalogue nor history, which is why they sit in their own file.
 *
 * It ships empty (D19): the plan is made in the app, never seeded and never
 * generated, so a first run has no plan until he makes one.
 */

import { eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import type { Id } from '../../domain/types';
import { db } from '../client';
import { settings, weeklySchedule } from '../schema';

/** 0 = Monday … 6 = Sunday, as the column says. */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/** The family planned for each day, or null for a rest day. */
export function listWeeklySchedule(): Map<DayOfWeek, Id | null> {
  const rows = db.select().from(weeklySchedule).all();
  const out = new Map<DayOfWeek, Id | null>();
  for (let day = 0; day < 7; day += 1) out.set(day as DayOfWeek, null);
  for (const row of rows) out.set(row.dayOfWeek as DayOfWeek, row.familyId);
  return out;
}

/** Live, so editing a day redraws the week without a manual refresh. */
export function useWeeklySchedule(): Map<DayOfWeek, Id | null> {
  const live = useLiveQuery(db.select().from(weeklySchedule));
  return useMemo(() => {
    const out = new Map<DayOfWeek, Id | null>();
    for (let day = 0; day < 7; day += 1) out.set(day as DayOfWeek, null);
    for (const row of live.data ?? []) out.set(row.dayOfWeek as DayOfWeek, row.familyId);
    return out;
  }, [live.data]);
}

/**
 * Plans a day, or clears it.
 *
 * A row per day rather than a row per session intended: the schedule is a
 * shape of week, and a day is either spoken for or it is a rest day.
 */
export function setScheduledFamily(dayOfWeek: DayOfWeek, familyId: Id | null): void {
  if (familyId === null) {
    db.delete(weeklySchedule).where(eq(weeklySchedule.dayOfWeek, dayOfWeek)).run();
    return;
  }

  db.insert(weeklySchedule)
    .values({ dayOfWeek, familyId })
    .onConflictDoUpdate({ target: weeklySchedule.dayOfWeek, set: { familyId } })
    .run();
}

/* ------------------------------------------------------------- settings bag */

export function getSetting(key: string): string | null {
  return db.select().from(settings).where(eq(settings.key, key)).get()?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  db.insert(settings)
    .values({ key, value })
    .onConflictDoUpdate({ target: settings.key, set: { value } })
    .run();
}

export function useSetting(key: string): string | null {
  const live = useLiveQuery(db.select().from(settings));
  return useMemo(
    () => (live.data ?? []).find((row) => row.key === key)?.value ?? null,
    [live.data, key],
  );
}
