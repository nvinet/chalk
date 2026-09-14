/**
 * What to train today, and how the week is going.
 *
 * Pure. Everything here is derived from sessions already logged, deliberately:
 * the weekly schedule is defined by hand and ships empty (D19), and Q9's
 * frequency values were never set — so there is no plan to measure against
 * yet. "Furthest behind the plan" becomes "least recently trained", which
 * needs only history and is honest about what it knows.
 *
 * When a schedule exists, the suggestion should defer to it and this becomes
 * the fallback for a week with no plan.
 */

import type { Family, Id, IsoDate, Session } from "./types.ts";

/** Monday, as an ISO date. Weeks start on Monday for a training week. */
export function startOfWeek(date: IsoDate): IsoDate {
  const d = new Date(`${date}T00:00:00`);
  // getDay is 0 for Sunday, so Sunday belongs to the week that just ended.
  const daysSinceMonday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - daysSinceMonday);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The seven dates of the week starting on `weekStart`, Monday first. */
export function weekDates(weekStart: IsoDate): IsoDate[] {
  const pad = (n: number) => String(n).padStart(2, "0");
  return Array.from({ length: 7 }, (_, offset) => {
    const d = new Date(`${weekStart}T00:00:00`);
    d.setDate(d.getDate() + offset);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });
}

/** Moves a whole number of weeks, for navigating in both directions. */
export function shiftWeek(weekStart: IsoDate, by: number): IsoDate {
  const d = new Date(`${weekStart}T00:00:00`);
  d.setDate(d.getDate() + by * 7);
  const pad = (n: number) => String(n).padStart(2, "0");
  return startOfWeek(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`);
}

/**
 * A session that counts as training.
 *
 * Abandoned sessions do not. Abandoning says the session did not happen, so
 * letting one mark a family as trained would defeat the only reason abandon
 * exists (#59).
 */
export function counts(session: Session): boolean {
  return session.status !== "abandoned";
}

/** Sessions logged in the week containing `today`, most recent first. */
export function sessionsThisWeek(sessions: Session[], today: IsoDate): Session[] {
  const from = startOfWeek(today);
  return sessions
    .filter(counts)
    .filter((s) => s.date >= from && s.date <= today)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

/** Sessions that happened in one particular week, whenever that week was. */
export function sessionsInWeek(sessions: Session[], weekStart: IsoDate): Session[] {
  const dates = weekDates(weekStart);
  const from = dates[0]!;
  const to = dates[6]!;
  return sessions
    .filter(counts)
    .filter((s) => s.date >= from && s.date <= to)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

export interface WeekAdherence {
  familyId: Id;
  /** Days of the week this family is planned for. Zero means unplanned. */
  target: number;
  /** Sessions that happened. Anything logged counts, met or not (C3). */
  attended: number;
  /** Of those, the ones that met every required group. */
  successful: number;
}

/**
 * How closely one week followed the plan (#33).
 *
 * **Attendance and success are different measures and both are kept** (C3).
 * A session counts towards the weekly target the moment anything is logged,
 * whether or not every group succeeded — turning up is the habit the plan is
 * about, and collapsing the two would let one bad session read as an absence.
 *
 * The target is derived from the schedule rather than stored: the plan is a
 * shape of week (`weekly_schedule` is a day → family map), so a family's
 * target is simply how many days it is given.
 *
 * `successfulIds` is passed in rather than computed here, because scoring a
 * session needs the catalogue and this file is deliberately pure.
 */
export function weekAdherence(
  families: Family[],
  schedule: Map<number, Id | null>,
  sessionsThatWeek: Session[],
  successfulIds: ReadonlySet<Id>,
): WeekAdherence[] {
  const target = new Map<Id, number>();
  for (const familyId of schedule.values()) {
    if (familyId === null) continue;
    target.set(familyId, (target.get(familyId) ?? 0) + 1);
  }

  return families
    .map((family) => {
      const mine = sessionsThatWeek.filter((s) => s.familyId === family.id);
      return {
        familyId: family.id,
        target: target.get(family.id) ?? 0,
        attended: mine.length,
        successful: mine.filter((s) => successfulIds.has(s.id)).length,
      };
    })
    // A family neither planned nor trained this week is not a row worth a line.
    .filter((row) => row.target > 0 || row.attended > 0);
}

/** How many sessions each family has had this week. Families with none read 0. */
export function countsByFamily(
  families: Family[],
  sessions: Session[],
): Map<Id, number> {
  const counts = new Map<Id, number>(families.map((f) => [f.id, 0]));
  for (const session of sessions) {
    const current = counts.get(session.familyId);
    if (current !== undefined) counts.set(session.familyId, current + 1);
  }
  return counts;
}

/** The most recent session for each family, whenever it was. */
export function lastSessionByFamily(sessions: Session[]): Map<Id, Session> {
  const latest = new Map<Id, Session>();
  for (const session of sessions.filter(counts)) {
    const held = latest.get(session.familyId);
    if (!held || held.date < session.date) latest.set(session.familyId, session);
  }
  return latest;
}

/**
 * Which family to suggest: the one left longest.
 *
 * A family never trained wins outright — it has been waiting since the
 * beginning. Ties break on the family's own display order, so the answer is
 * stable rather than dependent on map iteration.
 */
export function suggestFamily(families: Family[], sessions: Session[]): Family | null {
  const ordered = [...families].sort((a, b) => a.position - b.position);
  if (ordered.length === 0) return null;

  const latest = lastSessionByFamily(sessions);
  let best = ordered[0]!;
  let bestDate = latest.get(best.id)?.date ?? "";

  for (const family of ordered.slice(1)) {
    const date = latest.get(family.id)?.date ?? "";
    if (date < bestDate) {
      best = family;
      bestDate = date;
    }
  }
  return best;
}
