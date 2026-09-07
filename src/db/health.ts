import { sql } from 'drizzle-orm';

import { db } from './client';

export type DatabaseHealth =
  | { ok: true; sqliteVersion: string }
  | { ok: false; error: string };

/**
 * Proves the database opened and a query round-trips (acceptance for #10).
 *
 * Deliberately schema-free — `src/db/schema.ts` does not exist yet (#54) — so
 * this asks SQLite about itself rather than reading any table. Once real
 * queries exist this has no reason to survive.
 */
export function checkDatabaseHealth(): DatabaseHealth {
  try {
    const row = db.get<{ version: string }>(
      sql`select sqlite_version() as version`,
    );
    if (!row?.version) {
      return { ok: false, error: 'query returned no row' };
    }
    return { ok: true, sqliteVersion: row.version };
  } catch (cause) {
    return { ok: false, error: cause instanceof Error ? cause.message : String(cause) };
  }
}
