/**
 * The runtime record: what he actually did.
 *
 * Append-only in spirit. These rows refer to the catalogue by id but never own
 * it, and `SessionRequirement` deliberately *copies* the required counts that
 * applied at the time — so changing a family in November cannot retrospectively
 * fail August.
 */

import type { Id, IsoDate, IsoTimestamp } from "./common.ts";

export type SessionStatus = "inProgress" | "finished" | "abandoned";

export type SkipReason =
  | "equipmentBusy"
  | "equipmentBroken"
  | "injury"
  | "shortOfTime"
  | "other";

export interface SetEntry {
  id: Id;
  sessionId?: Id;
  exerciseId: Id;
  muscleGroupId: Id;
  setNumber: number;
  reps?: number | null;
  weightKg?: number | null;
  durationSeconds?: number | null;
  /** Canonical metres, displayed as km (D12). */
  distanceM?: number | null;
  /** Kept, but counts for nothing: not completion, not bests, not volume (D15). */
  warmup?: boolean;
  completed: boolean;
  skipped: boolean;
  skipReason?: SkipReason | null;
  note?: string | null;
}

/**
 * The requirement that applied when the session happened. Snapshotted onto
 * the session so that raising chest from one exercise to two in November
 * cannot retrospectively fail August.
 */
export interface SessionRequirement {
  muscleGroupId: Id;
  requiredExerciseCount: number;
  /**
   * Set when he deliberately passed on this group. It records *why* the group
   * went untrained; it never counts as training it (#24).
   */
  skipped?: boolean;
  skipReason?: SkipReason | null;
}

/**
 * What he set the machine to, for one exercise, on one day (#66).
 *
 * Belongs to the session rather than to the exercise: a bench angle is a fact
 * about that session's work, and editing the catalogue must not retrospectively
 * change what August appears to have done.
 */
export interface SessionExerciseNote {
  exerciseId: Id;
  muscleGroupId: Id;
  note: string;
}

export interface Session {
  id: Id;
  familyId: Id;
  date: IsoDate;
  startedAt: IsoTimestamp;
  finishedAt?: IsoTimestamp | null;
  status: SessionStatus;
  requirements: SessionRequirement[];
  sets: SetEntry[];
  notes?: string | null;
  /** Optional like `notes`: most sessions carry none. */
  exerciseNotes?: SessionExerciseNote[];
}

/** How a skip reads on screen. Ordered by how often it is the real answer. */
export const SKIP_REASONS: readonly { id: SkipReason; label: string }[] = [
  { id: "equipmentBusy", label: "Equipment busy" },
  { id: "equipmentBroken", label: "Equipment broken" },
  { id: "shortOfTime", label: "Short of time" },
  { id: "injury", label: "Injury" },
  { id: "other", label: "Other" },
];

export function skipReasonLabel(reason: SkipReason | null | undefined): string {
  return SKIP_REASONS.find((r) => r.id === reason)?.label ?? "Skipped";
}
