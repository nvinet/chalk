/**
 * Configuration: the weekly plan and the key/value settings bag.
 *
 * Neither is catalogue nor session. The schedule says what he intends; a
 * session says what he did.
 */

import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

import { families } from "./catalogue.ts";

export const weeklySchedule = sqliteTable("weekly_schedule", {
  /** 0 = Monday … 6 = Sunday. */
  dayOfWeek: integer("day_of_week").primaryKey(),
  familyId: text("family_id").references(() => families.id, {
    onDelete: "set null",
  }),
});

/* -------------------------------------------------------------- app config */

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export type WeeklyScheduleRow = typeof weeklySchedule.$inferSelect;
