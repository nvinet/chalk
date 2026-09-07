/** Shared by the session and config tables. */
import { sql } from "drizzle-orm";

export const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`;
