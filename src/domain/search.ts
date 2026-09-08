/**
 * Finding an exercise by name (#17).
 *
 * Every exercise carries the spellings the spreadsheet used — "hax squat",
 * "trycept pushdown", "peck fly". They are kept precisely so that searching
 * the way he has typed it for years still lands on the corrected name, which
 * is the difference between a rename being a courtesy and a nuisance.
 */

import type { Exercise } from "./types.ts";

/** Case and surrounding space are noise; nothing else is normalised. */
function normalise(text: string): string {
  return text.trim().toLowerCase();
}

/**
 * True when the query appears in the name or in any alias.
 *
 * A substring match rather than a prefix one: "squat" should find "Hack
 * squat", and "fly" should find both flies. An empty query matches everything,
 * so the list is the whole catalogue until something is typed.
 */
export function matchesExercise(exercise: Exercise, query: string): boolean {
  const needle = normalise(query);
  if (needle === "") return true;
  if (normalise(exercise.name).includes(needle)) return true;
  return exercise.aliases.some((alias) => normalise(alias).includes(needle));
}

/** The catalogue filtered by one query, in the order it was given. */
export function searchExercises(exercises: Exercise[], query: string): Exercise[] {
  return exercises.filter((exercise) => matchesExercise(exercise, query));
}
