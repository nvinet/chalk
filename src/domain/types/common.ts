/**
 * Primitives shared by both halves of the model.
 *
 * Kept apart so `catalogue.ts` and `sessions.ts` need not import each other:
 * a session refers to catalogue rows only by `Id`.
 */

export type Id = string;
/** ISO date, `YYYY-MM-DD`. */
export type IsoDate = string;
/** ISO 8601 timestamp. */
export type IsoTimestamp = string;
