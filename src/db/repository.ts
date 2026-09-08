/**
 * Catalogue and session queries.
 *
 * A barrel, mirroring the split in `schema.ts`: `repository/catalogue.ts` for
 * what exists to be trained, `repository/sessions.ts` for what happened.
 *
 * Everything here returns domain types, never Drizzle rows. Mapping happens in
 * `mappers.ts`, which is what keeps `src/domain/` free of the ORM.
 */

export * from './repository/catalogue.ts';
export * from './repository/sessions.ts';
