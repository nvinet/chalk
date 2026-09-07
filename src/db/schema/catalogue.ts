/**
 * Catalogue tables: what exists to be trained.
 *
 * Reference data — seeded on first launch, edited rarely. The joins *within*
 * this file cascade on delete, because a mapping is meaningless once its
 * machine is gone. Nothing here may cascade into a session: see sessions.ts.
 */

import { integer, primaryKey, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const families = sqliteTable("families", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  position: integer("position").notNull(),
  /** 0 for abs and cardio: their single muscle group is never shown. */
  usesMuscleGroups: integer("uses_muscle_groups", { mode: "boolean" })
    .notNull()
    .default(true),
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
  /** "weightReps" | "duration" | "distance" — one measure per machine (D12). */
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

export type FamilyRow = typeof families.$inferSelect;
export type MuscleGroupRow = typeof muscleGroups.$inferSelect;
export type MachineRow = typeof machines.$inferSelect;
