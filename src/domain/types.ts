/**
 * Chalk — domain types.
 *
 * Pure TypeScript. No React, no Drizzle, no Expo. Everything in `domain/`
 * must stay portable, because it is the part worth keeping if the app is
 * ever rebuilt natively.
 *
 * This file is a barrel. The model splits in two, and the split is real
 * rather than cosmetic:
 *
 *  - `types/catalogue.ts` — what exists to be trained. Reference data, seeded
 *    once and edited rarely.
 *  - `types/sessions.ts` — what actually happened. Written constantly, and
 *    irreplaceable: the catalogue can be re-seeded, a session cannot.
 *
 * Sessions refer to the catalogue by id and never own it. That is why exercises
 * and muscle groups archive rather than delete, and why `SessionRequirement`
 * copies the counts that applied at the time instead of reading them back.
 *
 * Import from here, not from the parts — it keeps the seam free to move.
 */

export * from './types/common.ts';
export * from './types/catalogue.ts';
export * from './types/sessions.ts';
