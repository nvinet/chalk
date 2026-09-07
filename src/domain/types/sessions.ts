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
  | "machineBusy"
  | "machineBroken"
  | "injury"
  | "shortOfTime"
  | "other";

export interface SetEntry {
  id: Id;
  sessionId?: Id;
  machineId: Id;
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
 * the session so that raising chest from one machine to two in November
 * cannot retrospectively fail August.
 */
export interface SessionRequirement {
  muscleGroupId: Id;
  requiredMachineCount: number;
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
}
