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

/** Sessions logged in the week containing `today`, most recent first. */
export function sessionsThisWeek(sessions: Session[], today: IsoDate): Session[] {
  const from = startOfWeek(today);
  return sessions
    .filter((s) => s.date >= from && s.date <= today)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
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
  for (const session of sessions) {
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
