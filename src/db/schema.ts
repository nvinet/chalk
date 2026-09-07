/**
 * Chalk — Drizzle schema for Expo SQLite.
 *
 * Deliberately plain SQLite with explicit foreign keys, so the file stays
 * readable by anything: a future native rewrite can open the same database,
 * and CSV export is a query rather than a serialisation layer.
 *
 * Weight is stored once, canonically, in kilograms. Display units are a
 * presentation concern (G1). Mixing units in storage is the sort of thing
 * that quietly corrupts a chart two years later.
 *
 * Regenerate migrations after editing:  npm run db:generate
 */

import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`;

/* ---------------------------------------------------------------- taxonomy */

export const families = sqliteTable("families", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  position: integer("position").notNull(),
  /** 0 for abs and cardio: their single muscle group is never shown. */
  usesMuscleGroups: integer("uses_muscle_groups", { mode: "boolean" })
    .notNull()
    .default(true),
  timesPerWeek: integer("times_per_week").notNull().default(0),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
});

export const muscleGroups = sqliteTable("muscle_groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  position: integer("position").notNull(),
  /** Placeholder group for a family that has none. Hidden in the UI. */
  implicit: integer("implicit", { mode: "boolean" }).notNull().default(false),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
});

/**
 * Which muscle groups make up a family, and how many machines each needs.
 * The count lives here — per group, per family — so chest can require two on
 * push day and something else elsewhere.
 */
export const familyMuscleGroups = sqliteTable(
  "family_muscle_groups",
  {
    familyId: text("family_id")
      .notNull()
      .references(() => families.id, { onDelete: "cascade" }),
    muscleGroupId: text("muscle_group_id")
      .notNull()
      .references(() => muscleGroups.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    /** 0 means optional: shown in the session, never blocking. */
    requiredMachineCount: integer("required_machine_count").notNull().default(1),
  },
  (t) => [primaryKey({ columns: [t.familyId, t.muscleGroupId] })],
);

export const machines = sqliteTable("machines", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  /** JSON array of old spreadsheet spellings, so search still finds them. */
  aliases: text("aliases", { mode: "json" }).$type<string[]>().notNull().default([]),
  /** "weightReps" | "duration" */
  tracking: text("tracking").notNull().default("weightReps"),
  weightIncrementKg: real("weight_increment_kg").notNull().default(2.5),
  defaultRestSeconds: integer("default_rest_seconds").notNull().default(90),
  notes: text("notes"),
  archived: integer("archived", { mode: "boolean" }).notNull().default(false),
});

/**
 * What a machine may be used for. Many-to-many and may cross families: the
 * Smith machine is chest and shoulders in push, and quads in legs.
 *
 * This grants no credit on its own. Credit comes from a set naming the group.
 */
export const machineMuscleGroups = sqliteTable(
  "machine_muscle_groups",
  {
    machineId: text("machine_id")
      .notNull()
      .references(() => machines.id, { onDelete: "cascade" }),
    muscleGroupId: text("muscle_group_id")
      .notNull()
      .references(() => muscleGroups.id, { onDelete: "cascade" }),
    /** How it is used here: "incline press", "squat", "pushdown". */
    variant: text("variant"),
    position: integer("position").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.machineId, t.muscleGroupId] })],
);

/* ---------------------------------------------------------------- sessions */

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
  (t) => [index("sessions_date_idx").on(t.date), index("sessions_family_idx").on(t.familyId)],
);

/**
 * The requirement that applied when the session happened, snapshotted so that
 * raising chest from one machine to two in November cannot retrospectively
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
    requiredMachineCount: integer("required_machine_count").notNull(),
  },
  (t) => [primaryKey({ columns: [t.sessionId, t.muscleGroupId] })],
);

/**
 * One recorded set. Carries machine AND muscle group, which is what lets the
 * same machine be logged twice in a session for two different groups without
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
    machineId: text("machine_id")
      .notNull()
      .references(() => machines.id),
    muscleGroupId: text("muscle_group_id")
      .notNull()
      .references(() => muscleGroups.id),
    setNumber: integer("set_number").notNull(),
    reps: integer("reps"),
    /** Canonical kilograms. May legitimately be 0 for a bodyweight sled. */
    weightKg: real("weight_kg"),
    durationSeconds: integer("duration_seconds"),
    completed: integer("completed", { mode: "boolean" }).notNull().default(true),
    skipped: integer("skipped", { mode: "boolean" }).notNull().default(false),
    skipReason: text("skip_reason"),
    note: text("note"),
    createdAt: text("created_at").notNull().default(now),
  },
  (t) => [
    uniqueIndex("set_entries_unique_idx").on(
      t.sessionId,
      t.machineId,
      t.muscleGroupId,
      t.setNumber,
    ),
    // The index that makes "last time on this machine for this group" fast.
    index("set_entries_pairing_idx").on(t.machineId, t.muscleGroupId),
    index("set_entries_session_idx").on(t.sessionId),
  ],
);

/* ----------------------------------------------------------------- targets */

export const targets = sqliteTable(
  "targets",
  {
    id: text("id").primaryKey(),
    machineId: text("machine_id")
      .notNull()
      .references(() => machines.id, { onDelete: "cascade" }),
    /** A target belongs to a machine used for a group, not a machine alone. */
    muscleGroupId: text("muscle_group_id")
      .notNull()
      .references(() => muscleGroups.id, { onDelete: "cascade" }),
    targetWeightKg: real("target_weight_kg"),
    targetReps: integer("target_reps"),
    targetSets: integer("target_sets"),
    dueDate: text("due_date"),
    createdAt: text("created_at").notNull().default(now),
    /** Kept after it is hit rather than deleted (D5). */
    achievedDate: text("achieved_date"),
  },
  (t) => [index("targets_pairing_idx").on(t.machineId, t.muscleGroupId)],
);

/* -------------------------------------------------------------- app config */

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type FamilyRow = typeof families.$inferSelect;
export type MuscleGroupRow = typeof muscleGroups.$inferSelect;
export type MachineRow = typeof machines.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
export type SetEntryRow = typeof setEntries.$inferSelect;
export type TargetRow = typeof targets.$inferSelect;
