/**
 * Chalk — Drizzle schema for Expo SQLite.
 *
 * Deliberately plain SQLite with explicit foreign keys, so the file stays
 * readable by anything: a future native rewrite can open the same database,
 * and CSV export is a query rather than a serialisation layer.
 *
 * Weight is stored once, canonically, in kilograms; distance in metres.
 * Display units are a presentation concern (G1). Mixing units in storage is
 * the sort of thing that quietly corrupts a chart two years later.
 *
 * This file is a barrel over three groups, and the grouping is the schema's
 * own delete behaviour made visible:
 *
 *  - `schema/catalogue.ts` — what exists to be trained. Its internal joins
 *    cascade, because a mapping is meaningless once its machine is gone.
 *  - `schema/sessions.ts` — what happened. Cascades from its own session, but
 *    *restricts* against the catalogue: a machine history mentions cannot be
 *    deleted, only archived.
 *  - `schema/config.ts` — the weekly plan and settings.
 *
 * One database, deliberately. Those four runtime→catalogue foreign keys are
 * load-bearing: every history, chart and personal best is keyed on the
 * (machine, muscle group) pairing, and SQLite does not enforce foreign keys
 * across attached databases.
 *
 * Regenerate migrations after editing:  npm run db:generate
 */

export * from './schema/catalogue.ts';
export * from './schema/sessions.ts';
export * from './schema/config.ts';
