/**
 * Chalk — scoring, history and personal bests.
 *
 * All of it keyed on the (exercise, muscle group) pairing rather than the
 * exercise alone: hammer curl logged for biceps and hammer curl logged for
 * forearms are different histories with different weights, and showing the
 * wrong one mid-set is worse than showing nothing.
 */

import { indexById, isSetLogged } from "./completion.ts";
import { formatWeightReps, trimDecimal } from "./measures.ts";
import { isWeightBased } from "./types.ts";
import type { Catalogue, Id, Exercise, Session, SetEntry } from "./types.ts";

/**
 * Re-exported so callers that already read formats from here keep working;
 * the definition lives in `measures.ts`, which is lower down the stack.
 */
export { formatWeightReps };

/** An exercise used for a specific muscle group. The unit of history. */
export interface Pairing {
  exerciseId: Id;
  muscleGroupId: Id;
}

export const pairingKey = (p: Pairing) => `${p.exerciseId}::${p.muscleGroupId}`;

const matches = (set: SetEntry, p: Pairing) =>
  set.exerciseId === p.exerciseId && set.muscleGroupId === p.muscleGroupId;

/** Volume for one set. Zero for timed work and for anything not recorded. */
export function setVolumeKg(set: SetEntry, exercise: Exercise): number {
  if (!isSetLogged(set, exercise.tracking)) return 0;
  if (!isWeightBased(exercise.tracking)) return 0;
  return (set.reps ?? 0) * (set.weightKg ?? 0);
}

export function sessionVolumeKg(
  session: Session,
  catalogue: Pick<Catalogue, "exercises">,
): number {
  const exercisesById = indexById(catalogue.exercises);
  return session.sets.reduce((total, set) => {
    const exercise = exercisesById.get(set.exerciseId);
    return exercise ? total + setVolumeKg(set, exercise) : total;
  }, 0);
}

/**
 * Volume and set count per muscle group. Exact, not estimated — every set
 * names its group, so nothing is attributed by guesswork.
 */
export function volumeByMuscleGroup(
  sessions: Session[],
  catalogue: Pick<Catalogue, "exercises">,
): Map<Id, { volumeKg: number; sets: number }> {
  const exercisesById = indexById(catalogue.exercises);
  const out = new Map<Id, { volumeKg: number; sets: number }>();
  for (const session of sessions) {
    for (const set of session.sets) {
      const exercise = exercisesById.get(set.exerciseId);
      if (!exercise || !isSetLogged(set, exercise.tracking)) continue;
      const row = out.get(set.muscleGroupId) ?? { volumeKg: 0, sets: 0 };
      row.volumeKg += setVolumeKg(set, exercise);
      row.sets += 1;
      out.set(set.muscleGroupId, row);
    }
  }
  return out;
}

/** Epley estimate. Meaningless above about 12 reps, so it is capped. */
export function estimatedOneRepMaxKg(reps: number, weightKg: number): number | null {
  if (!(reps > 0) || !(weightKg > 0) || reps > 12) return null;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

export interface PairingBest {
  heaviestKg: number | null;
  /**
   * Reps at the heaviest set, and the date it was done.
   *
   * The heaviest weight alone is not an answer to "what am I chasing" — 80 kg
   * for one is a different target from 80 kg for eight. Ties on weight are
   * broken by reps, so the best set at a given load is the one remembered.
   */
  heaviestReps: number | null;
  heaviestOn: string | null;
  bestEstimatedOneRepMaxKg: number | null;
  bestSetVolumeKg: number | null;
}

/** Bests across a history, for one pairing. */
export function bestsForPairing(
  sessions: Session[],
  pairing: Pairing,
  exercise: Exercise,
): PairingBest {
  let heaviest: number | null = null;
  let heaviestReps: number | null = null;
  let heaviestOn: string | null = null;
  let bestE1rm: number | null = null;
  let bestVolume: number | null = null;

  for (const session of sessions) {
    for (const set of session.sets) {
      if (!matches(set, pairing) || !isSetLogged(set, exercise.tracking)) continue;
      if (!isWeightBased(exercise.tracking)) continue;

      const weight = set.weightKg ?? 0;
      const reps = set.reps ?? 0;
      // Heavier always wins; at the same weight, more reps does.
      if (heaviest === null || weight > heaviest || (weight === heaviest && reps > (heaviestReps ?? 0))) {
        heaviest = weight;
        heaviestReps = reps;
        heaviestOn = session.date;
      }

      const e1rm = estimatedOneRepMaxKg(reps, weight);
      if (e1rm !== null) bestE1rm = bestE1rm === null ? e1rm : Math.max(bestE1rm, e1rm);

      const volume = setVolumeKg(set, exercise);
      bestVolume = bestVolume === null ? volume : Math.max(bestVolume, volume);
    }
  }
  return {
    heaviestKg: heaviest,
    heaviestReps,
    heaviestOn,
    bestEstimatedOneRepMaxKg: bestE1rm,
    bestSetVolumeKg: bestVolume,
  };
}

export interface NewPersonalBest {
  pairing: Pairing;
  kind: "heaviest" | "estimatedOneRepMax" | "setVolume";
  value: number;
  previous: number | null;
}

/**
 * Personal bests set *during* one session, judged against everything before
 * it. Detected, never entered by hand (D4).
 */
export function personalBestsInSession(
  session: Session,
  priorSessions: Session[],
  catalogue: Pick<Catalogue, "exercises">,
): NewPersonalBest[] {
  const exercisesById = indexById(catalogue.exercises);
  const earlier = priorSessions.filter((s) => s.id !== session.id);
  const seen = new Set<string>();
  const out: NewPersonalBest[] = [];

  for (const set of session.sets) {
    const exercise = exercisesById.get(set.exerciseId);
    // Cardio has no personal bests yet — "furthest" and "longest" are Q3's
    // question and belong to M4 (D12).
    if (!exercise || !isWeightBased(exercise.tracking)) continue;
    if (!isSetLogged(set, exercise.tracking)) continue;

    const pairing = { exerciseId: set.exerciseId, muscleGroupId: set.muscleGroupId };
    const key = pairingKey(pairing);
    if (seen.has(key)) continue;
    seen.add(key);

    const before = bestsForPairing(earlier, pairing, exercise);
    const now = bestsForPairing([session], pairing, exercise);

    const checks: Array<[NewPersonalBest["kind"], number | null, number | null]> = [
      ["heaviest", now.heaviestKg, before.heaviestKg],
      ["estimatedOneRepMax", now.bestEstimatedOneRepMaxKg, before.bestEstimatedOneRepMaxKg],
      ["setVolume", now.bestSetVolumeKg, before.bestSetVolumeKg],
    ];

    for (const [kind, current, previous] of checks) {
      if (current === null) continue;
      if (previous === null || current > previous) {
        out.push({ pairing, kind, value: current, previous });
      }
    }
  }
  return out;
}

export interface LoggedExercise {
  exerciseId: Id;
  muscleGroupId: Id;
  sets: SetEntry[];
}

/**
 * The session's work, grouped by pairing, in the order each was first logged
 * (#65).
 *
 * Keyed on the pairing rather than the exercise alone, for the reason D4
 * gives: the same exercise logged for two muscle groups is two separate pieces
 * of work, and merging them would show a chest set under forearms.
 *
 * Skip markers are left out. A skipped exercise is not a set he did, and the
 * reason is already reported against its muscle group.
 *
 * Warm-ups are kept. They count for nothing (D15) but they happened, and a
 * history that hides them misrepresents the session — the caller marks them.
 */
export function setsByPairing(session: Session): LoggedExercise[] {
  const order: string[] = [];
  const groups = new Map<string, LoggedExercise>();

  for (const set of session.sets) {
    if (set.skipped) continue;
    const key = pairingKey({ exerciseId: set.exerciseId, muscleGroupId: set.muscleGroupId });
    let group = groups.get(key);
    if (!group) {
      group = { exerciseId: set.exerciseId, muscleGroupId: set.muscleGroupId, sets: [] };
      groups.set(key, group);
      order.push(key);
    }
    group.sets.push(set);
  }

  return order.flatMap((key) => {
    const group = groups.get(key);
    return group ? [group] : [];
  });
}

export interface LastTime {
  date: string;
  sets: SetEntry[];
  topSetWeightKg: number | null;
  summary: string;
  /**
   * Reps of the top set, and that set written the way a best is written.
   *
   * `summary` describes the whole visit — "3 sets @ 82.5 kg" — which is the
   * right thing in a list of sessions. Beside a personal best it is the wrong
   * thing, because the two lines then answer different questions in different
   * orders and neither can be compared to the other at a glance (#67).
   */
  topSetReps: number | null;
  measure: string;
}

/**
 * What he did last time on this exercise for this muscle group — the single
 * most important thing on the logging screen (B6).
 */
export function lastTimeForPairing(
  sessions: Session[],
  pairing: Pairing,
  exercise: Exercise,
  before?: string,
): LastTime | null {
  const candidates = sessions
    .filter((s) => (before ? s.date < before : true))
    .filter((s) => s.sets.some((set) => matches(set, pairing) && isSetLogged(set, exercise.tracking)))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const session = candidates[0];
  if (!session) return null;

  const sets = session.sets.filter(
    (set) => matches(set, pairing) && isSetLogged(set, exercise.tracking),
  );

  if (exercise.tracking === "duration") {
    const seconds = sets.reduce((t, s) => t + (s.durationSeconds ?? 0), 0);
    return {
      date: session.date,
      sets,
      topSetWeightKg: null,
      topSetReps: null,
      summary: `${Math.round(seconds / 60)} min`,
      measure: `${Math.round(seconds / 60)} min`,
    };
  }

  if (exercise.tracking === "distance") {
    const metres = sets.reduce((t, s) => t + (s.distanceM ?? 0), 0);
    return {
      date: session.date,
      sets,
      topSetWeightKg: null,
      topSetReps: null,
      summary: formatKm(metres),
      measure: formatKm(metres),
    };
  }

  // The top set by the same rule a personal best uses — heaviest, and at equal
  // weight the one with more reps. "Last" and "best" then describe the same
  // kind of thing, which is what makes them comparable side by side.
  let topSet: SetEntry | null = null;
  for (const candidate of sets) {
    if (!topSet) {
      topSet = candidate;
      continue;
    }
    const w = candidate.weightKg ?? 0;
    const best = topSet.weightKg ?? 0;
    if (w > best || (w === best && (candidate.reps ?? 0) > (topSet.reps ?? 0))) {
      topSet = candidate;
    }
  }

  const topSetWeightKg = topSet?.weightKg ?? 0;
  const topSetReps = topSet?.reps ?? null;

  const reps = sets[0]?.reps ?? 0;
  const uniformReps = sets.every((s) => (s.reps ?? 0) === reps);
  const summary = uniformReps
    ? `${sets.length}×${reps} @ ${formatKg(topSetWeightKg)}`
    : `${sets.length} sets @ ${formatKg(topSetWeightKg)}`;

  return {
    date: session.date,
    sets,
    topSetWeightKg,
    topSetReps,
    summary,
    measure: formatWeightReps(topSetWeightKg, topSetReps),
  };
}

/** Metres in, kilometres out — distance is stored canonically in metres (D12). */
export function formatKm(metres: number): string {
  const km = Math.round((metres / 1000) * 100) / 100;
  return `${km} km`;
}

export function formatKg(kg: number): string {
  return `${trimDecimal(kg)} kg`;
}

/** Chart series for one pairing: heaviest set per session, oldest first. */
export function topSetSeries(
  sessions: Session[],
  pairing: Pairing,
  exercise: Exercise,
): Array<{ date: string; weightKg: number }> {
  // A non-weight exercise has no top set; charting one would draw a flat line
  // of zeroes (D12).
  if (!isWeightBased(exercise.tracking)) return [];

  return sessions
    .map((session) => {
      const weights = session.sets
        .filter((set) => matches(set, pairing) && isSetLogged(set, exercise.tracking))
        .map((set) => set.weightKg ?? 0);
      return weights.length
        ? { date: session.date, weightKg: Math.max(...weights) }
        : null;
    })
    .filter((p): p is { date: string; weightKg: number } => p !== null)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}
