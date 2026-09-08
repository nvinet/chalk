/**
 * Resting between sets (#27).
 *
 * A rest timer is **an end time, not a countdown**. That one choice is what
 * makes it survive the phone being locked, the app being backgrounded, and
 * JavaScript timers being throttled to nothing while he is actually lifting:
 * whatever happens in between, the remaining time is recomputed from the wall
 * clock and comes back correct. A decrementing counter would quietly lose
 * whatever it slept through.
 *
 * The length comes from the exercise (`defaultRestSeconds`), which is editable
 * per exercise. Nothing here decides how long a rest should be.
 */

export interface RestTimer {
  /** Which pairing the rest belongs to, so the screen shows only its own. */
  exerciseId: string;
  muscleGroupId: string;
  /** Wall-clock milliseconds. The single source of truth. */
  endsAtMs: number;
  /** What it was set to, for the progress bar and for "+30s" to build on. */
  totalSeconds: number;
}

/**
 * Null when the exercise asks for no rest, which is a real answer rather than
 * a missing one — a run has nothing to rest between.
 */
export function startRest(
  pairing: { exerciseId: string; muscleGroupId: string },
  seconds: number,
  nowMs: number,
): RestTimer | null {
  if (seconds <= 0) return null;
  return { ...pairing, endsAtMs: nowMs + seconds * 1000, totalSeconds: seconds };
}

/** Adds to the end time and to the total, so the bar stays honest. */
export function extendRest(timer: RestTimer, bySeconds: number): RestTimer {
  return {
    ...timer,
    endsAtMs: timer.endsAtMs + bySeconds * 1000,
    totalSeconds: timer.totalSeconds + bySeconds,
  };
}

/** Never negative: an overrun rest reads 0, not -47. */
export function remainingSeconds(timer: RestTimer, nowMs: number): number {
  return Math.max(0, Math.ceil((timer.endsAtMs - nowMs) / 1000));
}

export function isFinished(timer: RestTimer, nowMs: number): boolean {
  return nowMs >= timer.endsAtMs;
}

/** How much of the rest has gone, 0 to 1. Drives the bar. */
export function restProgress(timer: RestTimer, nowMs: number): number {
  if (timer.totalSeconds <= 0) return 1;
  const elapsed = timer.totalSeconds - remainingSeconds(timer, nowMs);
  return Math.min(1, Math.max(0, elapsed / timer.totalSeconds));
}

/** `1:12`, `0:05`. Minutes are never padded; seconds always are. */
export function formatRemaining(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safe / 60);
  return `${minutes}:${String(safe % 60).padStart(2, "0")}`;
}

/** True when this timer belongs to the exercise and group on screen. */
export function isForPairing(
  timer: RestTimer,
  pairing: { exerciseId: string; muscleGroupId: string },
): boolean {
  return (
    timer.exerciseId === pairing.exerciseId &&
    timer.muscleGroupId === pairing.muscleGroupId
  );
}
