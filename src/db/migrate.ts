import { sql } from 'drizzle-orm';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { useMemo } from 'react';

import migrations from '../../drizzle/migrations';
import { db } from './client';
import { applyCatalogueSeed, catalogueCounts, type CatalogueCounts } from './seed-runner';

export type MigrationState =
  | { status: 'running' }
  | { status: 'ready' }
  | { status: 'failed'; error: string };

/**
 * Applies pending migrations on launch.
 *
 * The import of `../../drizzle/migrations` is the reason babel.config.js needs
 * the inline-import plugin and metro.config.js needs `sql` in sourceExts: that
 * module imports the .sql file, which Metro cannot resolve on its own (#10).
 *
 * Migrations are versioned from the first release — no later version may
 * orphan his history (N9) — so a failure here must be visible, not swallowed.
 */
export function useMigrationState(): MigrationState {
  const { success, error } = useMigrations(db, migrations);
  if (error) return { status: 'failed', error: error.message };
  return success ? { status: 'ready' } : { status: 'running' };
}

export type CatalogueState =
  | { status: 'waiting' }
  | { status: 'ready'; counts: CatalogueCounts }
  | { status: 'failed'; error: string };

/**
 * Seeds the catalogue once the tables exist.
 *
 * Gated on migrations rather than run alongside them: the tables do not exist
 * until those have run.
 *
 * Derived rather than done in an effect. Both the seed and the count are
 * synchronous — the Expo driver is a sync dialect — so an effect would only
 * add a second render pass. What makes this safe is that the seed is
 * idempotent: every insert is onConflictDoNothing, so if React discards the
 * memo and runs it again, the second run writes nothing and returns the same
 * counts.
 */
export function useCatalogueState(migrations: MigrationState): CatalogueState {
  return useMemo<CatalogueState>(() => {
    if (migrations.status !== 'ready') return { status: 'waiting' };
    try {
      applyCatalogueSeed();
      return { status: 'ready', counts: catalogueCounts() };
    } catch (cause) {
      return {
        status: 'failed',
        error: cause instanceof Error ? cause.message : String(cause),
      };
    }
  }, [migrations.status]);
}

/**
 * How many migrations have been applied. A read, not a run.
 *
 * The root layout owns running them (#29); anything else that wants to report
 * on migrations should ask, not re-run, or drizzle would migrate twice.
 */
export function appliedMigrationCount(): number {
  const row = db.get<{ n: number }>(
    sql`select count(*) as n from __drizzle_migrations`,
  );
  return row?.n ?? 0;
}
