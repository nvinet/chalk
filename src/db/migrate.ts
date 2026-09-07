import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';

import migrations from '../../drizzle/migrations';
import { db } from './client';

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
