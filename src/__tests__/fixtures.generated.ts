/**
 * The eleven sessions actually logged in the spreadsheet, 17 August to
 * 16 September 2026.
 *
 * THIS FILE IS A STUB. The real fixtures are generated from
 * `gym_progression.xlsx`, which is not in this repository, so the sessions
 * cannot be reconstructed here. It exists only so the rest of the suite
 * compiles and runs.
 *
 * It is deliberately EMPTY rather than invented. These sessions are the
 * specification — their expected outcomes were computed independently from
 * the raw spreadsheet before the code existed — so plausible-looking made-up
 * data would produce a suite that passes while verifying nothing at all.
 *
 * The tests that need it skip themselves while this array is empty. Restore
 * the spreadsheet, regenerate, and they light up on their own.
 */

import type { Session } from "../domain/types.ts";

export const historicalSessions: Session[] = [];

/** True while the fixtures are the stub above. Drives the skips. */
export const fixturesAvailable = historicalSessions.length > 0;

/** Passed as test options so a fixture-dependent test skips with a reason. */
export const needsFixtures = {
  skip: fixturesAvailable
    ? false
    : "fixtures.generated.ts is a stub — regenerate from gym_progression.xlsx",
};
