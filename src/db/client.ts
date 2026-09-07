import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as SQLite from 'expo-sqlite';

export const DATABASE_NAME = 'chalk.db';

/**
 * The underlying expo-sqlite handle.
 *
 * `enableChangeListener` is what makes `useLiveQuery` work: without it SQLite
 * fires no update hook, so screens would read once and never refresh when a set
 * is written mid-session.
 */
export const expoDb = SQLite.openDatabaseSync(DATABASE_NAME, {
  enableChangeListener: true,
});

/**
 * The Drizzle handle every query goes through.
 *
 * No schema is passed yet — `src/db/schema.ts` is #54, blocked on the M0
 * decisions. Once it lands, this becomes `drizzle(expoDb, { schema })` and the
 * relational query API turns on.
 */
export const db = drizzle(expoDb);
