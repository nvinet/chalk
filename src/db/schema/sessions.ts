/**
 * Session tables: what actually happened.
 *
 * These reference the catalogue and are referenced by nothing. Note the delete
 * behaviour, which is the whole distinction in one line: session_requirements
 * and set_entries cascade from their *session*, but their references to
 * muscle_groups and exercises restrict. An exercise that history mentions cannot
 * be deleted — it archives instead.
 *
 * Irreplaceable, unlike the catalogue: re-seeding cannot bring a session back.
 */

import { eq, sql } from "drizzle-orm";
import { index, integer, real, primaryKey, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

import { families, exercises, muscleGroups } from "./catalogue.ts";
import { now } from "./common.ts";

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    familyId: text("family_id")
      .notNull()
      .references(() => families.id),
    /** YYYY-MM-DD, local date. Sorting and grouping are by this, not by timestamp. */
    date: text("date").notNull(),
    startedAt: text("started_at").notNull().default(now),
    finishedAt: text("finished_at"),
    /** "inProgress" | "finished" | "abandoned" */
    status: text("status").notNull().default("inProgress"),
    notes: text("notes"),
  },
  (t) => [
    index("sessions_date_idx").on(t.date),
    index("sessions_family_idx").on(t.familyId),
    /**
     * At most one session in progress (#58).
     *
     * A partial unique index rather than a check at the call site: everything
     * downstream assumes a single open session — activeSession() returns one,
     * and #23 resumes "the" interrupted one — so a second makes both
     * meaningless. Enforced here, the next screen cannot forget.
     */
    uniqueIndex("sessions_one_in_progress_idx")
      .on(t.status)
      .where(eq(t.status, sql`'inProgress'`)),
  ],
);

/**
 * The requirement that applied when the session happened, snapshotted so that
 * raising chest from one exercise to two in November cannot retrospectively
 * fail August.
 */
export const sessionRequirements = sqliteTable(
  "session_requirements",
  {
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    muscleGroupId: text("muscle_group_id")
      .notNull()
      .references(() => muscleGroups.id),
    position: integer("position").notNull(),
    requiredExerciseCount: integer("required_exercise_count").notNull(),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.muscleGroupId] })],
);

/**
 * One recorded set. Carries exercise AND muscle group, which is what lets the
 * same exercise be logged twice in a session for two different groups without
 * either use counting for the other.
 *
 * Written one row at a time as he taps, never batched at the end (N7).
 */
export const setEntries = sqliteTable(
  "set_entries",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    exerciseId: text("exercise_id")
      .notNull()
      .references(() => exercises.id),
    muscleGroupId: text("muscle_group_id")
      .notNull()
      .references(() => muscleGroups.id),
    setNumber: integer("set_number").notNull(),
    reps: integer("reps"),
    /** Canonical kilograms. May legitimately be 0 for a bodyweight sled. */
    weightKg: real("weight_kg"),
    durationSeconds: integer("duration_seconds"),
    /** Canonical metres, displayed as km. Jogging and swimming (D12). */
    distanceM: real("distance_m"),
    /**
     * Kept, but counts for nothing: not completion, not personal bests, not
     * volume (D15). The exclusion lives in isSetLogged, so one predicate
     * decides it everywhere.
     */
    warmup: integer("warmup", { mode: "boolean" }).notNull().default(false),
    completed: integer("completed", { mode: "boolean" }).notNull().default(true),
    skipped: integer("skipped", { mode: "boolean" }).notNull().default(false),
    skipReason: text("skip_reason"),
    note: text("note"),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [
    uniqueIndex("set_entries_unique_idx").on(
      t.sessionId,
      t.exerciseId,
      t.muscleGroupId,
      t.setNumber,
    ),
    // The index that makes "last time on this exercise for this group" fast.
    index("set_entries_pairing_idx").on(t.exerciseId, t.muscleGroupId),
    index("set_entries_session_idx").on(t.sessionId),
  ],
);

export type SessionRow = typeof sessions.$inferSelect;
export type SetEntryRow = typeof setEntries.$inferSelect;
