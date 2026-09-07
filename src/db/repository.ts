/**
 * Catalogue and session queries.
 *
 * A barrel, mirroring the split in `schema.ts`. Only the catalogue half exists
 * so far — session reads and writes arrive with the logging flow (#19-#23) and
 * belong in `repository/sessions.ts` when they do.
 *
 * Everything here returns domain types, never Drizzle rows. Mapping happens in
 * `mappers.ts`, which is what keeps `src/domain/` free of the ORM.
 */

export * from './repository/catalogue.ts';
