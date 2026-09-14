/**
 * Chalk — CSV export (#30).
 *
 * One row per set, carrying the exercise **and** the muscle group it counted
 * towards. That pairing is the whole point: a set belongs to both, and a file
 * that named only the exercise would throw away the thing that makes this
 * app's numbers exact rather than inferred (D4).
 *
 * With the JSON backup dropped (D27), this is the only way data leaves the
 * app. It is for reading elsewhere — a spreadsheet, a script — not for
 * restoring, which the device backup does better.
 *
 * Every set is included, not only the ones that counted. A warm-up, a skipped
 * exercise and an unusable entry are all part of what happened; the columns say
 * which is which, and a reader can filter. Deciding for him here would be the
 * export quietly disagreeing with the app.
 */

import { indexById, isSetLogged } from "./completion.ts";
import type { Catalogue, Session } from "./types.ts";

export const CSV_COLUMNS = [
  "date",
  "session_id",
  "family",
  "muscle_group",
  "exercise",
  "set_number",
  "reps",
  "weight_kg",
  "duration_seconds",
  "distance_m",
  "warmup",
  "skipped",
  "skip_reason",
  "counted",
  "session_status",
] as const;

/**
 * Quotes a field for CSV.
 *
 * Anything containing a comma, a quote or a newline is quoted and its quotes
 * doubled, which is the rule every spreadsheet agrees on. Exercise names are
 * his to write, so "Hammer curl, close grip" has to survive the round trip.
 */
function field(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

export function toCsv(
  sessions: Session[],
  catalogue: Pick<Catalogue, "exercises">,
  names: { families: Map<string, string>; muscleGroups: Map<string, string> },
): string {
  const exercisesById = indexById(catalogue.exercises);
  const rows: string[] = [CSV_COLUMNS.join(",")];

  // Oldest first: a file read top to bottom should run forwards in time.
  const ordered = [...sessions].sort((a, b) => (a.date < b.date ? -1 : 1));

  for (const session of ordered) {
    for (const set of session.sets) {
      const exercise = exercisesById.get(set.exerciseId);
      rows.push(
        [
          field(session.date),
          field(session.id),
          field(names.families.get(session.familyId) ?? session.familyId),
          field(names.muscleGroups.get(set.muscleGroupId) ?? set.muscleGroupId),
          field(exercise?.name ?? set.exerciseId),
          field(set.setNumber),
          field(set.reps),
          field(set.weightKg),
          field(set.durationSeconds),
          field(set.distanceM),
          field(set.warmup ? "yes" : "no"),
          field(set.skipped ? "yes" : "no"),
          field(set.skipReason),
          // Whether this set counted, by the app's own rule rather than the
          // reader's guess — so a spreadsheet can agree with the screens.
          field(exercise && isSetLogged(set, exercise.tracking) ? "yes" : "no"),
          field(session.status),
        ].join(","),
      );
    }
  }

  // A trailing newline: POSIX text, and it stops the last row being eaten by
  // tools that expect one.
  return `${rows.join("\n")}\n`;
}

/** `chalk-2026-09-14.csv` — dated, so two exports do not collide. */
export function csvFilename(today: string): string {
  return `chalk-${today}.csv`;
}
