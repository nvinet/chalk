/**
 * Chalk — scoring, history and personal bests.
 *
 * All of it keyed on the (machine, muscle group) pairing rather than the
 * machine alone: the Smith machine used for chest and the Smith machine used
 * for shoulders are different histories with different weights, and showing
 * the wrong one mid-set is worse than showing nothing.
 */

import { indexById, isSetLogged } from "./completion.ts";
import type { Catalogue, Id, Machine, Session, SetEntry } from "./types.ts";

/** A machine used for a specific muscle group. The unit of history. */
export interface Pairing {
  machineId: Id;
  muscleGroupId: Id;
}

export const pairingKey = (p: Pairing) => `${p.machineId}::${p.muscleGroupId}`;

const matches = (set: SetEntry, p: Pairing) =>
  set.machineId === p.machineId && set.muscleGroupId === p.muscleGroupId;

/** Volume for one set. Zero for timed work and for anything not recorded. */
export function setVolumeKg(set: SetEntry, machine: Machine): number {
  if (!isSetLogged(set, machine.tracking)) return 0;
  if (machine.tracking === "duration") return 0;
  return (set.reps ?? 0) * (set.weightKg ?? 0);
}

export function sessionVolumeKg(
  session: Session,
  catalogue: Pick<Catalogue, "machines">,
): number {
  const machinesById = indexById(catalogue.machines);
  return session.sets.reduce((total, set) => {
    const machine = machinesById.get(set.machineId);
    return machine ? total + setVolumeKg(set, machine) : total;
  }, 0);
}

/**
 * Volume and set count per muscle group. Exact, not estimated — every set
 * names its group, so nothing is attributed by guesswork.
 */
export function volumeByMuscleGroup(
  sessions: Session[],
  catalogue: Pick<Catalogue, "machines">,
): Map<Id, { volumeKg: number; sets: number }> {
  const machinesById = indexById(catalogue.machines);
  const out = new Map<Id, { volumeKg: number; sets: number }>();
  for (const session of sessions) {
    for (const set of session.sets) {
      const machine = machinesById.get(set.machineId);
      if (!machine || !isSetLogged(set, machine.tracking)) continue;
      const row = out.get(set.muscleGroupId) ?? { volumeKg: 0, sets: 0 };
      row.volumeKg += setVolumeKg(set, machine);
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
  bestEstimatedOneRepMaxKg: number | null;
  bestSetVolumeKg: number | null;
}

/** Bests across a history, for one pairing. */
export function bestsForPairing(
  sessions: Session[],
  pairing: Pairing,
  machine: Machine,
): PairingBest {
  let heaviest: number | null = null;
  let bestE1rm: number | null = null;
  let bestVolume: number | null = null;

  for (const session of sessions) {
    for (const set of session.sets) {
      if (!matches(set, pairing) || !isSetLogged(set, machine.tracking)) continue;
      if (machine.tracking === "duration") continue;

      const weight = set.weightKg ?? 0;
      const reps = set.reps ?? 0;
      heaviest = heaviest === null ? weight : Math.max(heaviest, weight);

      const e1rm = estimatedOneRepMaxKg(reps, weight);
      if (e1rm !== null) bestE1rm = bestE1rm === null ? e1rm : Math.max(bestE1rm, e1rm);

      const volume = setVolumeKg(set, machine);
      bestVolume = bestVolume === null ? volume : Math.max(bestVolume, volume);
    }
  }
  return {
    heaviestKg: heaviest,
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
  catalogue: Pick<Catalogue, "machines">,
): NewPersonalBest[] {
  const machinesById = indexById(catalogue.machines);
  const earlier = priorSessions.filter((s) => s.id !== session.id);
  const seen = new Set<string>();
  const out: NewPersonalBest[] = [];

  for (const set of session.sets) {
    const machine = machinesById.get(set.machineId);
    if (!machine || machine.tracking === "duration") continue;
    if (!isSetLogged(set, machine.tracking)) continue;

    const pairing = { machineId: set.machineId, muscleGroupId: set.muscleGroupId };
    const key = pairingKey(pairing);
    if (seen.has(key)) continue;
    seen.add(key);

    const before = bestsForPairing(earlier, pairing, machine);
    const now = bestsForPairing([session], pairing, machine);

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

export interface LastTime {
  date: string;
  sets: SetEntry[];
  topSetWeightKg: number | null;
  summary: string;
}

/**
 * What he did last time on this machine for this muscle group — the single
 * most important thing on the logging screen (B6).
 */
export function lastTimeForPairing(
  sessions: Session[],
  pairing: Pairing,
  machine: Machine,
  before?: string,
): LastTime | null {
  const candidates = sessions
    .filter((s) => (before ? s.date < before : true))
    .filter((s) => s.sets.some((set) => matches(set, pairing) && isSetLogged(set, machine.tracking)))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const session = candidates[0];
  if (!session) return null;

  const sets = session.sets.filter(
    (set) => matches(set, pairing) && isSetLogged(set, machine.tracking),
  );

  if (machine.tracking === "duration") {
    const seconds = sets.reduce((t, s) => t + (s.durationSeconds ?? 0), 0);
    return {
      date: session.date,
      sets,
      topSetWeightKg: null,
      summary: `${Math.round(seconds / 60)} min`,
    };
  }

  const topSetWeightKg = Math.max(...sets.map((s) => s.weightKg ?? 0));
  const reps = sets[0]?.reps ?? 0;
  const uniformReps = sets.every((s) => (s.reps ?? 0) === reps);
  const summary = uniformReps
    ? `${sets.length}×${reps} @ ${formatKg(topSetWeightKg)}`
    : `${sets.length} sets @ ${formatKg(topSetWeightKg)}`;

  return { date: session.date, sets, topSetWeightKg, summary };
}

export function formatKg(kg: number): string {
  const rounded = Math.round(kg * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)} kg`;
}

/** Chart series for one pairing: heaviest set per session, oldest first. */
export function topSetSeries(
  sessions: Session[],
  pairing: Pairing,
  machine: Machine,
): Array<{ date: string; weightKg: number }> {
  return sessions
    .map((session) => {
      const weights = session.sets
        .filter((set) => matches(set, pairing) && isSetLogged(set, machine.tracking))
        .map((set) => set.weightKg ?? 0);
      return weights.length
        ? { date: session.date, weightKg: Math.max(...weights) }
        : null;
    })
    .filter((p): p is { date: string; weightKg: number } => p !== null)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}
